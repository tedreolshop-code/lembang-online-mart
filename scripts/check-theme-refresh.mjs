/* Regresi tema di browser, dengan Supabase tiruan (tidak mengubah data toko).
   node scripts/check-theme-refresh.mjs
   Memerlukan Edge, atau BROWSER_PATH yang menunjuk Chromium. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright-core";

const custom = { colorPrimary: "#16a34a", colorDark: "#14532d" };
const old = { colorPrimary: "#8b5cf6", colorDark: "#3b0764" };
const defaults = { colorPrimary: "#dc2626", colorDark: "#991b1b" };
let row = {
  id: 1, name: "Test Store", tagline: "Test", whatsapp: "628123456789",
  address: "Test", hours: "Test", ongkir: 0, free_ongkir_min: 0,
  color_primary: custom.colorPrimary, color_dark: custom.colorDark,
};
let themeFails = true;
let settingsFail = true;
let themeReads = 0;
let settingsDelay = 0;
let holdTheme = null;

const db = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/auth/v1/user") {
    res.end(JSON.stringify({ id: "test-admin", email: "theme@example.test" }));
    return;
  }
  if (url.pathname !== "/rest/v1/settings") {
    res.end("[]");
    return;
  }
  if (req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    row = { ...row, ...JSON.parse(body) };
    res.end("null");
    return;
  }
  const themeOnly = url.searchParams.get("select") !== "*";
  if (themeOnly) themeReads++;
  const snapshot = { ...row };
  if (themeOnly && holdTheme) await holdTheme;
  if (!themeOnly && settingsDelay) await delay(settingsDelay);
  if (themeOnly ? themeFails : settingsFail) {
    // 500 bukan status retry otomatis Supabase; tiap pembacaan deterministik.
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "Simulated outage" }));
  } else {
    res.end(JSON.stringify([snapshot]));
  }
});

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
await new Promise((resolve) => db.listen(0, "127.0.0.1", resolve));
const dbUrl = `http://127.0.0.1:${db.address().port}`;
const port = Number(process.env.THEME_TEST_PORT || 3210);
const base = `http://127.0.0.1:${port}`;
let server;
let browser;
let serverLog = "";

async function startServer(local = false) {
  serverLog = "";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: local ? "" : dbUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local ? "" : "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: local ? "" : "test-service-key",
      ADMIN_EMAIL: "theme@example.test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data) => { serverLog += data; });
  server.stderr.on("data", (data) => { serverLog += data; });
  const deadline = Date.now() + 90_000;
  while (!serverLog.includes("Ready in")) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error(serverLog);
    await delay(200);
  }
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  await exited;
}

async function openPage(mirror, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ mirror }) => {
    if (mirror && !sessionStorage.getItem("theme-test-seeded")) {
      localStorage.setItem("los_settings_v1", JSON.stringify(mirror));
      sessionStorage.setItem("theme-test-seeded", "1");
    }
    window.themeFrames = [];
    const sample = () => {
      if (document.querySelector("header")) {
        const css = getComputedStyle(document.documentElement);
        window.themeFrames.push([
          css.getPropertyValue("--color-brand").trim(),
          css.getPropertyValue("--color-navy").trim(),
        ]);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, { mirror });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|hydrated|did not match/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  // Tahan JS agar paint HTML awal benar-benar ikut diuji sebelum hidrasi.
  await page.route("**/_next/**/*.js*", async (route) => {
    await delay(500);
    await route.continue();
  });
  await page.goto(base, { waitUntil: "load", timeout: 90_000 });
  await page.waitForSelector("header");
  return { context, page, errors };
}

async function assertStable(test, expected, label) {
  await delay(700);
  const frames = await test.page.evaluate(() => window.themeFrames);
  assert.ok(frames.length > 1, `${label}: belum ada paint`);
  assert.deepEqual([...new Set(frames.map((frame) => frame.join(",")))],
    [`${expected.colorPrimary},${expected.colorDark}`], `${label}: warna berubah antar-frame`);
  assert.deepEqual(test.errors, [], `${label}: error hidrasi/browser`);
  console.log(`ok — ${label} (${frames.length} frame)`);
}

try {
  await startServer();
  browser = await chromium.launch({
    ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : { channel: "msedge" }),
    headless: true,
  });

  const fallback = await openPage(custom);
  await assertStable(fallback, custom, "cold start + API gagal mempertahankan mirror");
  assert.equal(await fallback.page.locator("#los-theme-init-css").count(), 1);
  await fallback.context.close();

  themeFails = false;
  settingsFail = false;
  await delay(10_100); // lewati jeda retry setelah gangguan cold start
  settingsDelay = 1200;
  const fresh = await openPage(old, { width: 1280, height: 900 });
  await delay(1500);
  await assertStable(fresh, custom, "SSR terbaru mengalahkan mirror lama, API lambat");
  assert.equal(await fresh.page.locator("#los-theme-init").count(), 0);
  for (let i = 0; i < 3; i++) {
    await fresh.page.reload({ waitUntil: "load" });
    await delay(1500);
    await assertStable(fresh, custom, `refresh desktop ${i + 1}`);
  }

  // Klien baru tanpa localStorage tetap mendapat lastGood pada request
  // gagal pertama DAN request berikutnya selama jeda retry.
  themeFails = true;
  settingsFail = true;
  settingsDelay = 0;
  const readsBeforeFailure = themeReads;
  for (let i = 0; i < 2; i++) {
    const outage = await openPage(null);
    await assertStable(outage, custom, `cache server saat gangguan ${i + 1}`);
    await outage.context.close();
  }
  assert.equal(themeReads, readsBeforeFailure + 1, "request gagal harus diberi jeda retry");

  themeFails = false;
  settingsFail = false;
  // Simpan melalui API sungguhan, memakai admin Supabase tiruan.
  const saved = await fresh.page.request.put(`${base}/api/settings`, {
    headers: { Authorization: "Bearer test-admin-token" },
    data: { ...defaults },
  });
  assert.equal(saved.status(), 200);
  // Polling harus menerima warna default sebagai data yang sudah siap.
  await fresh.page.waitForFunction(({ colorPrimary, colorDark }) => {
    const css = getComputedStyle(document.documentElement);
    return css.getPropertyValue("--color-brand").trim() === colorPrimary &&
      css.getPropertyValue("--color-navy").trim() === colorDark;
  }, defaults, { timeout: 20_000 });
  console.log("ok — perubahan tema ke default diterima tanpa reload");
  await fresh.page.reload({ waitUntil: "load" });
  await assertStable(fresh, defaults, "refresh setelah admin menyimpan default");

  // Query lama yang selesai setelah penyimpanan tidak boleh mengganti
  // fallback baru. Tahan satu pembacaan, simpan, lalu lepaskan pembacaan.
  let release;
  holdTheme = new Promise((resolve) => { release = resolve; });
  const beforeRace = themeReads;
  const inFlight = fresh.page.request.get(base);
  while (themeReads === beforeRace) await delay(50);
  const changed = await fresh.page.request.put(`${base}/api/settings`, {
    headers: { Authorization: "Bearer test-admin-token" }, data: custom,
  });
  assert.equal(changed.status(), 200);
  release();
  holdTheme = null;
  await inFlight;
  themeFails = true;
  settingsFail = true;
  const race = await openPage(null);
  await assertStable(race, custom, "query sebelum simpan tidak menimpa fallback baru");
  await race.context.close();
  await fresh.context.close();

  await stopServer();
  await startServer(true);
  const local = await openPage(custom);
  await assertStable(local, custom, "tema lokal bertahan dari prapaint sampai hidrasi");
  assert.equal(await local.page.locator("#los-theme-init-css").count(), 0);
  await local.page.reload({ waitUntil: "load" });
  await assertStable(local, custom, "refresh mode lokal");
  await local.context.close();
  console.log("Semua pemeriksaan tema lulus.");
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
  db.closeAllConnections();
  await new Promise((resolve) => db.close(resolve));
}
