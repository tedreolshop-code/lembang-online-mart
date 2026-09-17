/** Pembatas laju sederhana per-IP — untuk endpoint PUBLIK yang menerima
    identitas (nomor WA, kode pesanan, kode agen).

    BATAS KEMAMPUAN (sengaja jujur, jangan dianggap penghalang serius):
    - Hitungan disimpan di memori proses. Di serverless (Vercel) tiap instance
      punya memori sendiri dan bisa didaur ulang, jadi penyerang yang menyebar
      ke banyak instance lambat laun tetap lolos.
    - Untuk perlindungan serius, ganti penyimpanannya dengan Redis/Upstash —
      bagian `store` di bawah tinggal ditukar tanpa mengubah pemanggilnya.

    Tujuannya di sini adalah menaikkan biaya penebakan massal (enumerasi
    nomor HP / kode) dari "gratis dan instan" menjadi "mahal dan terlihat di
    log", bukan menutupnya mutlak. */

const store = new Map<string, number[]>();
const MAX_ENTRIES = 10000;

export interface RateLimit {
  /** Batas percobaan dalam jendela waktu. */
  max: number;
  /** Panjang jendela dalam milidetik. */
  windowMs: number;
}

/** Ambil IP pemanggil dari header proxy bila ada. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "tanpa-ip"
  );
}

/** Buang entri kedaluwarsa supaya memori tidak tumbuh selamanya. */
function sweep(now: number) {
  for (const [key, hits] of store) {
    const hidup = hits.filter((t) => t > now);
    if (hidup.length === 0) store.delete(key);
    else if (hidup.length !== hits.length) store.set(key, hidup);
  }
}

/** Catat satu percobaan. Return `null` bila boleh lanjut, atau lama tunggu
    (detik) bila sudah melewati batas. */
export function hitRateLimit(
  key: string,
  { max, windowMs }: RateLimit,
): number | null {
  const now = Date.now();

  // buang kedaluwarsa saat map mulai besar, agar biayanya tetap jarang
  if (store.size > MAX_ENTRIES) sweep(now);

  const hits = (store.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= max) {
    const tungguMs = hits[0] + windowMs - now;
    return Math.max(1, Math.ceil(tungguMs / 1000));
  }
  hits.push(now);
  store.set(key, hits);
  return null;
}

/** Jawaban 429 standar (Retry-After dalam detik). */
export function tooManyRequests(tungguDetik: number): Response {
  return Response.json(
    { error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." },
    { status: 429, headers: { "Retry-After": String(tungguDetik) } },
  );
}
