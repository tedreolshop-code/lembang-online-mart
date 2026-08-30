import Link from "next/link";
import { DEFAULT_SETTINGS as STORE_CONFIG } from "@/lib/config";

export const metadata = { title: "Kebijakan Privasi" };

export default function PrivasiPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
          Kebijakan Privasi 🔒
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Terakhir diperbarui: Agustus 2026
        </p>

        <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-600 sm:text-base">
          <section>
            <h2 className="font-bold text-slate-800">1. Data yang kami kumpulkan</h2>
            <p className="mt-1">
              Saat memesan, kami meminta <b>nama, nomor HP/WhatsApp, dan alamat
              pengiriman</b> — semuanya hanya dipakai untuk memproses dan
              mengantar pesanan Anda. Data pesanan Anda juga diteruskan ke
              WhatsApp warung untuk konfirmasi.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-slate-800">2. Data yang tidak kami kumpulkan</h2>
            <p className="mt-1">
              Kami tidak meminta data kartu kredit/pinjol, tidak menjual data
              Anda kepada pihak mana pun, dan tidak memakai data Anda untuk
              iklan.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-slate-800">3. Keranjang &amp; favorit</h2>
            <p className="mt-1">
              Isi keranjang dan daftar favorit disimpan di perangkat Anda
              sendiri (bukan di server kami), sehingga hanya Anda yang bisa
              melihatnya.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-slate-800">4. Hak Anda</h2>
            <p className="mt-1">
              Anda berhak meminta salinan, koreksi, atau penghapusan data
              pesanan Anda sewaktu-waktu — cukup hubungi kami lewat WhatsApp.
              Kami menghormati hak Anda sesuai UU Perlindungan Data Pribadi
              (UU PDP) Indonesia.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-slate-800">5. Hubungi kami</h2>
            <p className="mt-1">
              Pertanyaan soal data pribadi? WhatsApp kami di{" "}
              <a
                className="font-semibold text-brand hover:underline"
                href={`https://wa.me/${STORE_CONFIG.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                +{STORE_CONFIG.whatsapp}
              </a>{" "}
              atau datang langsung ke warung ({STORE_CONFIG.hours}).
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark"
        >
          Kembali Berbelanja →
        </Link>
      </div>
    </div>
  );
}
