"use client";

import { useEffect, useState } from "react";
import { adminLogout, adminRefresh, cloudMode, hasAdminSession, verifyAdminSession } from "@/lib/auth";
import Login from "@/components/admin/Login";
import Dashboard from "@/components/admin/Dashboard";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    // Sesi belum tentu milik admin: Supabase Auth terbuka untuk pendaftaran,
    // jadi verifikasi ke server (cookie HttpOnly) sebelum menampilkan dashboard.
    void (async () => {
      const ok = hasAdminSession() && (await verifyAdminSession()).ok;
      if (!ok) await adminLogout();
      if (!alive) return;
      setLoggedIn(ok);
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Perpanjang sesi berkala selama login (access token Supabase ~1 jam) supaya
  // admin tidak tiba-tiba terlempar. 40 menit < masa token.
  useEffect(() => {
    if (!cloudMode || !loggedIn) return;
    const id = window.setInterval(async () => {
      const ok = await adminRefresh();
      if (!ok) {
        await adminLogout();
        setLoggedIn(false);
      }
    }, 40 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loggedIn]);

  if (!checked) return null;

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;

  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}
