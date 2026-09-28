/** Pembatas laju per-IP — untuk endpoint PUBLIK yang menerima identitas
    (nomor WA, kode pesanan, kode agen).

    Dua mode:
    - DURABLE (disarankan di produksi): bila UPSTASH_REDIS_REST_URL &
      UPSTASH_REDIS_REST_TOKEN diisi, hitungan disimpan di Upstash Redis
      sehingga berlaku lintas instance serverless dan tidak hilang saat cold
      start. Dipakai lewat REST API (tanpa dependensi npm tambahan).
    - MEMORI (fallback): tanpa kredensial (atau bila Redis bermasalah),
      hitungan disimpan di memori proses. Di serverless mode ini bisa dilewati
      penyerang yang menyebar ke banyak instance.

    Tujuannya menaikkan biaya penebakan massal (enumerasi nomor HP / kode) dari
    "gratis dan instan" menjadi "mahal dan terlihat di log". */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const durableEnabled = !!UPSTASH_URL && !!UPSTASH_TOKEN;

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

/* ── mode memori (fallback) ─────────────────────────────────────── */

const store = new Map<string, number[]>();
const MAX_ENTRIES = 10000;

/** Buang entri kedaluwarsa supaya memori tidak tumbuh selamanya. */
function sweep(now: number) {
  for (const [key, hits] of store) {
    const hidup = hits.filter((t) => t > now);
    if (hidup.length === 0) store.delete(key);
    else if (hidup.length !== hits.length) store.set(key, hidup);
  }
}

function memoryHit(key: string, { max, windowMs }: RateLimit): number | null {
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

/* ── mode durable (Upstash Redis via REST) ──────────────────────── */

/** Kirim satu perintah Redis ke Upstash; mengembalikan field `result`. */
async function redisCommand(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json?.result;
}

/** Fixed window: INCR lalu set kedaluwarsa saat hitungan pertama. */
async function redisHit(key: string, { max, windowMs }: RateLimit): Promise<number | null> {
  const k = `rl:${key}`;
  const count = Number(await redisCommand(["INCR", k]));
  if (count === 1) await redisCommand(["PEXPIRE", k, windowMs]);
  if (count > max) {
    const pttl = Number(await redisCommand(["PTTL", k]));
    return Math.max(1, Math.ceil((pttl > 0 ? pttl : windowMs) / 1000));
  }
  return null;
}

/** Catat satu percobaan. Return `null` bila boleh lanjut, atau lama tunggu
    (detik) bila sudah melewati batas. */
export async function hitRateLimit(
  key: string,
  limit: RateLimit,
): Promise<number | null> {
  if (durableEnabled) {
    try {
      return await redisHit(key, limit);
    } catch {
      // Redis bermasalah → JANGAN matikan pembatas; pakai memori sementara.
    }
  }
  return memoryHit(key, limit);
}

/** Jawaban 429 standar (Retry-After dalam detik). */
export function tooManyRequests(tungguDetik: number): Response {
  return Response.json(
    { error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." },
    { status: 429, headers: { "Retry-After": String(tungguDetik) } },
  );
}
