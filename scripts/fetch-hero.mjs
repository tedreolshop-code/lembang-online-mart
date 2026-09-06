/* Cari & unduh kandidat foto hero (gudang/toko sembako) untuk beranda.
   Cara pakai: node scripts/fetch-hero.mjs  → public/hero-candidate-*.jpg */
import { writeFileSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const QUERIES = [
  "warehouse worker checking inventory clipboard",
  "warehouse aisle full cardboard boxes pexels",
  "supermarket shelves stocked goods aisle photo",
  "grosir toko sembako rak penuh foto",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchBing(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const decoded = html.replaceAll("&quot;", '"');
  const urls = [];
  for (const m of decoded.matchAll(/"murl":"(.*?)"/g)) {
    try {
      urls.push(JSON.parse(`"${m[1]}"`));
    } catch {
      /* url rusak, lewati */
    }
  }
  return urls;
}

/** dimensi gambar dari header JPEG/PNG (tanpa dependensi) */
function imageSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.length - 9) {
        if (buf[o] !== 0xff) break;
        const marker = buf[o + 1];
        const len = buf.readUInt16BE(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5) };
        }
        o += 2 + len;
      }
    }
  } catch {
    /* biarkan null */
  }
  return null;
}

function isImageFile(buf) {
  if (buf.length < 40000) return false;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  return jpg || png;
}

async function download(u) {
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": UA, Referer: "https://www.bing.com/" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isImageFile(buf)) return null;
    const dim = imageSize(buf);
    // hero dipakai landscape: lebar ≥ tinggi, dan tidak ekstrem kecil
    if (!dim || dim.w < 700 || dim.w < dim.h) return null;
    return { buf, dim };
  } catch {
    return null;
  }
}

let saved = 0;
const TOTAL = 6;
outer: for (const query of QUERIES) {
  process.stdout.write(`"${query}" …\n`);
  try {
    const urls = await searchBing(query);
    for (const u of [...new Set(urls)]) {
      const got = await download(u);
      if (!got) continue;
      saved++;
      const file = `public/hero-candidate-${saved}.jpg`;
      writeFileSync(file, got.buf);
      console.log(
        `  ok ${got.dim.w}x${got.dim.h} (${Math.round(got.buf.length / 1024)} KB) ← ${u.slice(0, 80)}`,
      );
      if (saved >= TOTAL) break outer;
    }
  } catch (e) {
    console.log("  gagal:", e.message);
  }
  await sleep(800);
}
console.log(saved > 0 ? `Tersimpan ${saved} kandidat.` : "TIDAK KETEMU.");
process.exit(saved > 0 ? 0 : 1);
