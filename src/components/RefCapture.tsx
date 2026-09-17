"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { storeAgentRef, trackAgentRef } from "@/lib/store";

/** Menangkap ?ref=KODE pada tautan referral agen (v6) di halaman mana pun:
    laporkan klik (menambah total_klik + memvalidasi agen) lalu simpan kode
    agar otomatis terisi di checkout. Setelah itu ?ref= dibuang dari URL. */
export default function RefCapture() {
  const params = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const ref = params.get("ref");
    if (!ref) return;
    const code = ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return;
    // simpan dulu (berlaku default 30 hari), lalu laporkan klik — respons
    // membawa link_days + harga khusus agen (v9) yang sebenarnya
    storeAgentRef(code, 30);
    void trackAgentRef(code).then((r) => {
      if (!r.ok) return;
      storeAgentRef(code, r.linkDays ?? 30, r.prices ?? []);
    });
    // buang ?ref= dari address bar (tanpa reload)
    const sp = new URLSearchParams(params);
    sp.delete("ref");
    const qs = sp.toString();
    window.history.replaceState({}, "", pathname + (qs ? `?${qs}` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
