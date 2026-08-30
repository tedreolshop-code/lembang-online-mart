/* Cari & unduh foto produk dari Bing Images → public/products/
   Prioritas: gambar dari domain Indonesia (kemasan sesuai pasar lokal).
   Jalankan: node scripts/fetch-images.mjs */
import { mkdirSync, writeFileSync, existsSync, statSync, unlinkSync } from "node:fs";

const OUT = "public/products";
mkdirSync(OUT, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/* id produk → kata kunci pencarian yang disaring per produk */
const QUERIES = {
  "indomie-goreng-pcs": "indomie mi goreng 85g",
  "indomie-goreng-dus": "indomie mi goreng dus 40 pcs",
  "mie-sedaap-goreng": "mie sedaap goreng 91g",
  "indomie-kuah-ayam-bawang": "indomie kuah ayam bawang",
  "mie-sedaap-soto": "mie sedaap kuah soto",
  "indomie-kari-ayam": "indomie kari ayam",
  "minyak-sania-1l": "minyak goreng sania 1 liter",
  "minyak-bimoli-2l": "minyak goreng bimoli 2 liter",
  "minyak-kautaman-1l": "minyak goreng kautaman 1 liter",
  "gula-gulaku-1kg": "gulaku gula pasir premium 1 kg",
  "gula-kristal-1kg": "gula kristal putih 1 kg",
  "beras-premium-5kg": "beras pandan wangi premium 5 kg",
  "beras-medium-5kg": "beras medium 5 kg",
  "telur-ayam-setengah": "telur ayam negeri segar",
  "terigu-segitiga-1kg": "terigu segitiga biru 1 kg",
  "aqua-600ml": "aqua air mineral botol 600ml",
  "aqua-galon": "aqua galon 19 liter",
  "kapal-api-165g": "kopi kapal api special 165 gr",
  "kapal-api-sachet": "kopi kapal api sachet",
  "teh-pucuk-350ml": "teh pucuk harum 350ml",
  "ultra-milk-coklat": "ultra milk cokelat 250ml",
  "teh-kotak-300ml": "teh kotak sosro 300ml",
  "chitato-sapi-panggang": "chitato sapi panggang 68g",
  "roma-kelapa": "biskuit roma kelapa",
  "oreo-original": "oreo original 133g",
  "silverqueen-chunky": "silverqueen chunky bar cokelat",
  "taro-net": "taro net snack seaweed",
  "mamypoko-m34": "mamypoko pants M 34",
  "sweety-silver-m34": "popok sweety silver M",
  "genki-m30": "popok genki pants M",
  "wet-tissue-malinda": "tisu basah malinda",
  "rinso-770g": "rinso anti noda 770g",
  "sunlight-755ml": "sunlight jeruk nipis 755ml",
  "lifebuoy-110g": "sabun lifebuoy 110g",
  "shampo-sachet-12": "clear shampo sachet",
  "pepsodent-190g": "pepsodent pasta gigi 190g",
  "kecap-bango-520": "kecap manis bango 520ml",
  "saos-abc-340": "saos sambal abc 340ml",
  "garam-500g": "garam beryawan 500g",
  "sarden-botan": "sarden botan 155g",
  "royko-ayam": "royko kaldu ayam",
};

/* skor domain: makin tinggi makin dipercaya (kemasan Indonesia / toko resmi) */
function scoreUrl(u) {
  const s = u.toLowerCase();
  let score = 0;
  if (s.includes("alfagift.id")) score += 6;
  if (s.includes("images.tokopedia.net")) score += 5;
  if (s.includes("s1.bukalapak.com") || s.includes("bukalapak")) score += 5;
  if (s.includes("susercontent.com")) score += 4;
  if (s.includes(".co.id") || s.includes(".id/")) score += 3;
  if (s.includes("blibli")) score += 3;
  for (const bad of [
    "woolworths", "amazon", "walmart", "target.com", "costco",
    "carrefour.fr", "jumia", "ubuy", "desertcart", "ebay", "aliexpress",
  ]) {
    if (s.includes(bad)) score -= 5;
  }
  if (s.endsWith(".svg")) score -= 3;
  return score;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchBing(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9" } });
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

function extOf(u) {
  const m = u.toLowerCase().match(/\.(jpe?g|png|webp)(?:[?#]|$)/);
  return m ? (m[1] === "jpeg" ? "jpg" : m[1]) : null;
}

function isImageFile(buf) {
  if (buf.length < 8000) return false; // terlalu kecil = ikon/error
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const webp = buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  return jpg || png || webp;
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
    return buf;
  } catch {
    return null;
  }
}

const result = {};
let no = 0;
for (const [id, query] of Object.entries(QUERIES)) {
  no++;
  process.stdout.write(`[${no}/${Object.keys(QUERIES.length ? QUERIES : {})}] ${id} … `);
  let saved = null;
  try {
    const urls = await searchBing(query);
    const ranked = [...new Set(urls)].sort((a, b) => scoreUrl(b) - scoreUrl(a)).slice(0, 6);
    for (const u of ranked) {
      const buf = await download(u);
      if (!buf) continue;
      const ext = extOf(u) ?? "jpg";
      const file = `${id}.${ext}`;
      writeFileSync(`${OUT}/${file}`, buf);
      saved = `/products/${file}`;
      console.log(`ok  (${Math.round(buf.length / 1024)} KB)  ←  ${u.slice(0, 70)}`);
      break;
    }
  } catch (e) {
    /* lanjut ke produk berikutnya */
  }
  if (!saved) console.log("GAGAL — pakai emoji");
  result[id] = saved;
  await sleep(900);
}

writeFileSync("scripts/images-result.json", JSON.stringify(result, null, 2));
const ok = Object.values(result).filter(Boolean).length;
console.log(`\nSELESAI: ${ok}/${Object.keys(result).length} produk dapat foto`);
