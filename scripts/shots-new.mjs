/* Screenshot cepat untuk review desain baru. Server dev di localhost:3100. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3100";
const OUT = "shots-new";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

async function shoot(name, path, viewport, fullPage = true) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log("ok:", name);
  await ctx.close();
}

await shoot("01-beranda-desktop", "/", { width: 1280, height: 900 });
await shoot("02-beranda-mobile", "/", { width: 390, height: 844 });
await shoot("03-kategori-desktop", "/kategori", { width: 1280, height: 900 });
await shoot("04-detail-desktop", "/produk/indomie-goreng-pcs", { width: 1280, height: 900 });
await shoot("05-cari-desktop", "/cari?q=minyak", { width: 1280, height: 900 });
await shoot("06-keranjang-desktop", "/keranjang", { width: 1280, height: 900 });

await browser.close();
