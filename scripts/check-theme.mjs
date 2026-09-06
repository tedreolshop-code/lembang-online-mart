/* Cek/ubah warna tema tersimpan di Supabase.
   node scripts/check-theme.mjs            → lihat nilai sekarang
   node scripts/check-theme.mjs #b91c1c    → set warna gelap (dark)   */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const arg = process.argv[2];
if (arg) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(arg) ? arg : `#${arg}`;
  const { error } = await db.from("settings").update({ color_dark: hex }).eq("id", 1);
  console.log(error ? "GAGAL: " + error.message : `color_dark diubah ke ${hex}`);
}
const { data, error } = await db.from("settings").select("id, name, color_primary, color_dark").eq("id", 1).single();
console.log(error ? "ERR: " + error.message : JSON.stringify(data));
