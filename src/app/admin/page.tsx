"use client";

import { useEffect, useState } from "react";
import { adminLogout, hasAdminSession, verifyAdminSession } from "@/lib/auth";
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

  if (!checked) return null;

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;

  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}
