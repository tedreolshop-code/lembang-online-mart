"use client";

import { useState } from "react";
import { useSettings } from "@/lib/store";
import { cloudMode, adminLogin, adminLogout, localLogin, verifyAdminSession } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/config";
import Logo from "@/components/Logo";

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const settings = useSettings();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (cloudMode) {
        // mode database: Supabase Auth email + password
        const res = await adminLogin(email.trim(), password);
        if (!res.ok) throw new Error(res.error ?? "Login gagal.");
        // Berhasil login Supabase ≠ admin: pendaftaran akun terbuka, jadi
        // emailnya wajib terdaftar di ADMIN_EMAIL sebelum masuk dashboard.
        const cek = await verifyAdminSession();
        if (!cek.ok) {
          await adminLogout();
          throw new Error(cek.error ?? "Akun ini bukan admin.");
        }
      } else {
        // mode lokal demo: password dari Pengaturan
        if (password !== settings.adminPassword) {
          throw new Error("Password salah, coba lagi.");
        }
        localLogin();
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="rounded-2xl bg-white p-6 shadow-md">
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-3 text-center text-lg font-extrabold tracking-tight text-slate-800">
          {settings.name}
        </h1>
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
          Admin
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {cloudMode && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email admin"
              className="input text-center"
              autoFocus
              required
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={cloudMode ? "Password" : "Password admin"}
            className="input text-center"
            autoFocus={!cloudMode}
            required
          />
          {error && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-center text-sm font-semibold text-brand">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow transition hover:bg-brand-dark disabled:bg-slate-300"
          >
            {busy ? "Memproses…" : "Masuk"}
          </button>
        </form>
        {cloudMode ||
        settings.adminPassword === DEFAULT_SETTINGS.adminPassword ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
            {cloudMode ? (
              "Masuk dengan akun admin Supabase."
            ) : (
              <>
                Demo: password <b className="font-mono">admin123</b>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ── dashboard ────────────────────────────────────────────────── */

export default Login;
