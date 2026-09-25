import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Hash & verifikasi password pelanggan (server-only).

    scrypt bawaan Node — tanpa dependensi tambahan. Format tersimpan:
    `s1$<saltHex>$<hashHex>`; prefix versi memudahkan migrasi algoritma
    di masa depan. Verifikasi memakai timingSafeEqual agar tidak bocor
    lewat perbedaan waktu. */

const KEYLEN = 64;

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, KEYLEN);
  return `s1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Verifikasi secret terhadap hash tersimpan. Hash kosong (akun lama
    yang belum punya password) selalu gagal. */
export function verifySecret(secret: string, stored: string): boolean {
  if (!stored) return false;
  const [ver, saltHex, hashHex] = stored.split("$");
  if (ver !== "s1" || !saltHex || !hashHex) return false;
  try {
    const hash = scryptSync(secret, Buffer.from(saltHex, "hex"), KEYLEN);
    return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
  } catch {
    return false;
  }
}
