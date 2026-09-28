import { isCloud, isCloudMisconfigured } from "@/lib/db";

/** GET: status mode server untuk diprobe client saat boot.
    `cloud` = server benar-benar memakai database. Bila client menganggap
    dirinya mode cloud tetapi `cloud` di sini false, berarti env setengah
    jalan — client menampilkan banner alih-alih menyajikan data seed diam. */
export async function GET() {
  const misconfigured = isCloudMisconfigured();
  return Response.json(
    {
      cloud: isCloud,
      misconfigured,
      error: misconfigured
        ? "SUPABASE_SERVICE_ROLE_KEY belum diisi di server."
        : isCloud
          ? null
          : "Database cloud belum terhubung (mode lokal).",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
