/* Uji browser/API kategori dengan database tiruan; tidak mengubah toko.
   node scripts/check-categories.mjs (Edge atau BROWSER_PATH ke Chromium) */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { join } from "node:path";

let categories = [
  { slug: "mie-instan", name: "Mie Pilihan", emoji: "🍜", tint: "#fff1e6", sort: 0 },
  { slug: "sembako", name: "Sembako Harian", emoji: "🌾", tint: "#fff8e1", sort: 1 },
];
const product = { id: "mie-test", name: "Mie Test", category_slug: "mie-instan", price: 3500, stock: 10, emoji: "🍜", unit: "1 pcs", cost_price: 2500 };
let failCategories = false;
let pauseCategories = null;
let readCount = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const db = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/auth/v1/user") {
    res.end(JSON.stringify({ id: "test", email: req.headers.authorization === "Bearer admin-test" ? "admin@example.test" : "buyer@example.test" }));
    return;
  }
  if (url.pathname === "/rest/v1/categories") {
    const slug = url.searchParams.get("slug")?.replace(/^eq\./, "");
    if (req.method === "GET") {
      readCount++;
      const snapshot = structuredClone(categories);
      if (pauseCategories) await pauseCategories;
      if (failCategories) { res.statusCode = 500; res.end(JSON.stringify({ message: "outage" })); return; }
      res.end(JSON.stringify(snapshot.sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug))));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    let saved;
    if (req.method === "POST") {
      if (categories.some((c) => c.slug === input.slug)) {
        res.statusCode = 409; res.end(JSON.stringify({ code: "23505" })); return;
      }
      saved = input;
      categories.push(saved);
    } else {
      const current = categories.find((c) => c.slug === slug);
      if (current) { Object.assign(current, input); saved = current; }
    }
    res.end(JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? saved : saved ? [saved] : []));
    return;
  }
  if (url.pathname === "/rest/v1/settings") {
    res.end(JSON.stringify([{ id: 1, name: "Warung Test", whatsapp: "628123456789", color_primary: "#dc2626", color_dark: "#991b1b" }]));
    return;
  }
  if (url.pathname === "/rest/v1/products") { res.end(JSON.stringify([product])); return; }
  res.end("[]");
});
await new Promise((resolve) => db.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:3212";
const dbUrl = `http://127.0.0.1:${db.address().port}`;
let server;
let logs = "";
let browser;
async function start(local = false) {
  logs = "";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3212"], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: local ? "" : dbUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local ? "" : "test", SUPABASE_SERVICE_ROLE_KEY: local ? "" : "test", ADMIN_EMAIL: "admin@example.test" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data) => { logs += data; });
  server.stderr.on("data", (data) => { logs += data; });
  const deadline = Date.now() + 90_000;
  while (!logs.includes("Ready in")) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error(logs);
    await delay(200);
  }
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
  await exited;
}
async function adminContext(local = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ local }) => {
    localStorage.setItem("setupGuideDone", "1");
    sessionStorage.setItem("los_admin_session", "1");
    if (!local) sessionStorage.setItem("los_admin_auth_v1", JSON.stringify({ access_token: "admin-test", email: "admin@example.test" }));
  }, { local });
  return ctx;
}
async function tab(page) {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.getByRole("button", { name: "🗂️ Kategori", exact: true }).click();
  await page.getByRole("heading", { name: "Kategori Produk" }).waitFor();
}
const errors = [];
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /hydration|hydrated|did not match/i.test(message.text())) errors.push(message.text()); });
}
async function shot(page, name) {
  // Direktori harus sudah ada; opsional untuk review visual lokal.
  if (process.env.CATEGORIES_SHOTS_DIR) {
    await page.screenshot({ path: join(process.env.CATEGORIES_SHOTS_DIR, `${name}.png`), fullPage: true });
  }
}

try {
  await start();
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: "msedge" }) });
  const ctx = await adminContext();
  const page = await ctx.newPage();
  watch(page);
  await tab(page);
  await shot(page, "categories-admin-mobile");
  assert.equal(await page.getByRole("button", { name: "Edit kategori Mie Pilihan", exact: true }).count(), 1);
  // API: publik dapat membaca, hanya admin dapat menulis, input invalid ditolak.
  const input = { name: "Sayur & Buah", emoji: "🥬", tint: "#eef7ee", sort: 2 };
  assert.equal((await page.request.post(`${base}/api/categories`, { data: input })).status(), 401);
  assert.equal((await page.request.post(`${base}/api/categories`, { data: input, headers: { Authorization: "Bearer buyer-test" } })).status(), 401);
  assert.equal((await page.request.post(`${base}/api/categories`, { data: { ...input, name: " " }, headers: { Authorization: "Bearer admin-test" } })).status(), 400);
  assert.equal((await page.request.patch(`${base}/api/categories/missing`, { data: input, headers: { Authorization: "Bearer admin-test" } })).status(), 404);
  console.log("ok — otorisasi, validasi input, kategori tidak ditemukan");

  await page.getByRole("button", { name: "Tambah Kategori", exact: true }).click();
  await page.getByLabel("Nama kategori", { exact: true }).fill(input.name);
  await page.getByRole("button", { name: "Pilih ikon 🥬", exact: true }).click();
  await page.getByRole("button", { name: "Pilih warna 5", exact: true }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "form overflow mobile");
  await shot(page, "categories-form-mobile");
  await page.getByRole("button", { name: "Simpan Kategori", exact: true }).click();
  await page.getByText("berhasil disimpan.", { exact: false }).waitFor();
  assert.equal(categories.find((c) => c.slug === "sayur-buah")?.emoji, "🥬");
  await page.getByRole("button", { name: "Tambah produk di sini →" }).click();
  assert.equal(await page.getByRole("combobox").first().inputValue(), "sayur-buah");
  console.log("ok — tambah kategori melalui UI dan langsung pilih untuk produk baru");

  await page.getByRole("button", { name: "🗂️ Kategori", exact: true }).click();
  await page.getByRole("button", { name: "Edit kategori Mie Pilihan", exact: true }).click();
  await page.getByLabel("Nama kategori", { exact: true }).fill("Mie & Bihun");
  await page.getByLabel("Urutan tampil", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await page.getByRole("button", { name: "Edit kategori Mie & Bihun", exact: true }).waitFor();
  assert.equal(product.category_slug, "mie-instan");
  assert.equal(categories.find((c) => c.slug === "mie-instan")?.sort, 8);
  await page.getByRole("button", { name: "Tambah Kategori", exact: true }).click();
  await page.getByLabel("Nama kategori", { exact: true }).fill("Sayur & Buah");
  await page.getByRole("button", { name: "Simpan Kategori", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "sudah ada" }).waitFor();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  console.log("ok — edit nama/urutan tanpa mengubah relasi, duplikat memberi pesan jelas");

  await page.goto(`${base}/kategori/mie-instan`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Mie & Bihun", exact: true }).waitFor();
  await page.getByRole("link", { name: /Mie Test/ }).first().waitFor();
  await page.goto(`${base}/produk/mie-test`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('nav a[href="/kategori/mie-instan"]').textContent(), "Mie & Bihun");
  await page.goto(`${base}/cari`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "🥬 Sayur & Buah", exact: true }).click();
  await page.getByText("Barang tidak ditemukan", { exact: true }).waitFor();
  console.log("ok — halaman kategori, breadcrumb produk, dan filter pencarian sinkron");

  const publicCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const shop = await publicCtx.newPage();
  watch(shop);
  await shop.addInitScript(() => {
    window.categoryFrames = [];
    const sample = () => {
      const section = [...document.querySelectorAll("section")].find((node) => node.textContent.includes("Belanja per Kategori"));
      if (section) window.categoryFrames.push([...section.querySelectorAll('a[href^="/kategori/"]')].map((link) => link.textContent.trim().replace(/\s+/g, " ")));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await shop.route("**/_next/**/*.js*", async (route) => { await delay(400); await route.continue(); });
  for (let i = 0; i < 2; i++) {
    await shop.goto(base, { waitUntil: "networkidle" });
    const frames = await shop.evaluate(() => window.categoryFrames);
    assert.ok(frames.length > 1);
    assert.equal(new Set(frames.map((frame) => JSON.stringify(frame))).size, 1, "daftar kategori berubah saat hidrasi");
    assert.deepEqual(frames[0], ["🌾Sembako Harian", "🥬Sayur & Buah", "🍜Mie & Bihun"]);
    assert.ok(await shop.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "overflow mobile");
  }
  console.log("ok — urutan dan nama terbaru sejak HTML pertama, refresh tanpa daftar bawaan");
  await shot(shop, "categories-shop-mobile");
  await shop.setViewportSize({ width: 1280, height: 900 });
  assert.ok(await shop.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // Simulasikan refresh lama yang datang setelah edit admin.
  await tab(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "categories-admin-desktop");
  await page.bringToFront();
  let release;
  pauseCategories = new Promise((resolve) => { release = resolve; });
  const before = readCount;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const deadline = Date.now() + 5000;
  while (readCount === before && Date.now() < deadline) await delay(50);
  assert.ok(readCount > before);
  await page.getByRole("button", { name: "Edit kategori Mie & Bihun", exact: true }).click();
  await page.getByRole("button", { name: "Pilih warna 5", exact: true }).click();
  await page.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await page.getByText("berhasil disimpan.", { exact: false }).waitFor();
  release(); pauseCategories = null;
  await delay(500);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("los_categories_v1")).find((c) => c.slug === "mie-instan").tint), "#eef7ee");
  console.log("ok — respons refresh lama tidak menimpa edit admin terbaru");

  failCategories = true;
  await shop.goto(`${base}/kategori`, { waitUntil: "networkidle" });
  await shop.getByText("Sayur & Buah", { exact: true }).waitFor();
  console.log("ok — kegagalan API mempertahankan mirror kategori terakhir");
  failCategories = false;
  await ctx.close();
  await publicCtx.close();
  await stop();

  await start(true);
  const localCtx = await adminContext(true);
  const local = await localCtx.newPage(); watch(local);
  await tab(local);
  await local.getByRole("button", { name: "Tambah Kategori", exact: true }).click();
  await local.getByLabel("Nama kategori", { exact: true }).fill("Frozen Food");
  await local.getByRole("button", { name: "Pilih ikon 🧊", exact: true }).click();
  await local.getByRole("button", { name: "Simpan Kategori", exact: true }).click();
  await local.getByRole("button", { name: "Edit kategori Frozen Food", exact: true }).waitFor();
  await local.getByRole("button", { name: "Tambah produk di sini →" }).click();
  await local.getByLabel("Nama Produk *", { exact: true }).fill("Nugget Ayam Test");
  await local.getByLabel("Harga Jual (Rp) *", { exact: true }).fill("20000");
  await local.getByLabel("Harga Beli / HPP (Rp) *", { exact: false }).fill("15000");
  await local.getByRole("button", { name: "Simpan Produk", exact: true }).click();
  await local.getByRole("button", { name: "Edit Nugget Ayam Test", exact: true }).waitFor();
  assert.equal(await local.evaluate(() => JSON.parse(localStorage.getItem("los_products_v2")).find((p) => p.name === "Nugget Ayam Test").category), "frozen-food");
  await tab(local);
  await local.getByRole("button", { name: "Edit kategori Frozen Food", exact: true }).waitFor();
  const other = await localCtx.newPage(); watch(other);
  await other.goto(`${base}/kategori`, { waitUntil: "networkidle" });
  await local.getByRole("button", { name: "Edit kategori Frozen Food", exact: true }).click();
  await local.getByLabel("Nama kategori", { exact: true }).fill("Makanan Beku");
  await local.getByRole("button", { name: "Simpan Perubahan", exact: true }).click();
  await other.getByText("Makanan Beku", { exact: true }).waitFor();
  await other.goto(`${base}/kategori/frozen-food`, { waitUntil: "networkidle" });
  await other.getByRole("heading", { name: "Makanan Beku", exact: true }).waitFor();
  await other.getByRole("link", { name: /Nugget Ayam Test/ }).first().waitFor();
  console.log("ok — mode lokal: tambah, refresh, edit, dan sinkron antar-tab");
  console.log("ok — produk baru tersimpan di kategori baru dan tetap terhubung setelah edit nama");
  await localCtx.close();
  assert.deepEqual(errors, [], "error browser/hidrasi");
  console.log("Semua pemeriksaan kategori lulus.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  await stop();
  db.closeAllConnections();
  await new Promise((resolve) => db.close(resolve));
}
