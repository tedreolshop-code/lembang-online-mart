/* Screenshot semua halaman LEMBANG ONLINE MART untuk review visual.
   Jalankan dengan server produksi sudah berjalan di localhost:3000. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
});

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

async function shot(name, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log("ok:", name);
}

async function goto(path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

/* ── 1. halaman publik (desktop) ─────────────────────────────── */
await goto("/");
await shot("01-beranda-desktop");

await goto("/kategori");
await shot("02-kategori-desktop");

await goto("/kategori/mie-instan");
await shot("03-kategori-mie-desktop");

await goto("/produk/indomie-goreng-pcs");
await shot("04-detail-produk-desktop");

await goto("/cari?q=minyak");
await shot("05-pencarian-desktop");

await goto("/cara-pesan");
await shot("06-cara-pesan-desktop");

await goto("/tentang");
await shot("07-tentang-desktop");

await goto("/favorit");
await shot("08-favorit-kosong");

await goto("/keranjang");
await shot("09-keranjang-kosong");

/* ── 2. alur belanja: isi keranjang → checkout → pesanan ─────── */
await goto("/");
for (const label of [
  "Tambah Indomie Mi Goreng ke keranjang",
  "Tambah Minyak Goreng Sania ke keranjang",
  "Tambah Minyak Goreng Sania ke keranjang",
  "Tambah Popok MamyPoko Pants M ke keranjang",
]) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(200);
}

await goto("/keranjang");
await shot("10-keranjang-isi");

await goto("/checkout");
await page.getByPlaceholder("cth: Budi Santoso").fill("Ibu Sari Wulandari");
await page.getByPlaceholder("cth: 0812xxxxxxx").fill("081234567890");
await page
  .getByPlaceholder("Nama jalan, RT/RW, desa/dusun, patokan…")
  .fill("Jl. Raya Lembang No. 45, RT 03/RW 02, Kayuambon, dekat Masjid Al-Ikhlas");
await page.getByPlaceholder("cth: telur yang tidak retak ya").fill("Tolong pakingan aman ya");
await shot("11-checkout-terisi");

await page.getByRole("button", { name: "Buat Pesanan" }).click();
await page.waitForURL("**/pesanan?sukses=*");
await shot("12-pesanan-sukses");

await goto("/pesanan");
await shot("13-riwayat-pesanan");

/* ── 3. admin ────────────────────────────────────────────────── */
await goto("/admin");
await shot("14-admin-login");

await page.getByPlaceholder("Password admin").fill("admin123");
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForTimeout(800);
await shot("15-admin-produk");

await page.getByRole("button", { name: /Pesanan/ }).click();
await page.waitForTimeout(500);
await shot("16-admin-pesanan");

/* ── 4. mobile ───────────────────────────────────────────────── */
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const mp = await mctx.newPage();
mp.setDefaultTimeout(15000);

async function mshot(name) {
  await mp.waitForLoadState("networkidle");
  await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("ok:", name);
}

await mp.goto(BASE + "/", { waitUntil: "networkidle" });
await mshot("17-beranda-mobile");

await mp.goto(BASE + "/produk/indomie-goreng-pcs", { waitUntil: "networkidle" });
await mshot("18-detail-produk-mobile");

/* tambah ke keranjang dari detail produk (mobile) */
await mp.getByRole("button", { name: "+ Keranjang" }).click();
await mp.waitForTimeout(300);
await mp.goto(BASE + "/keranjang", { waitUntil: "networkidle" });
await mshot("19-keranjang-mobile");

await browser.close();
console.log("SELESAI");
