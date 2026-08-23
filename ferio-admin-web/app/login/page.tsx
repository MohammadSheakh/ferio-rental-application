'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1';
const STORAGE_KEY = 'ferio_identity';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [creds, setCreds] = useState({ email: '', password: '' });

  async function attempt(email: string, password: string, code?: string) {
    const res = await fetch(`${API_URL}/identity/platform/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(code ? { code } : {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? 'Login failed');
    return json.data ?? json;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    const code = needsTotp ? String(f.get('code') ?? '') : undefined;

    setBusy(true);
    setError(null);
    try {
      const data = await attempt(email, password, code);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: data.token, user: data.user }),
      );
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (/TOTP code required/i.test(message)) {
        setCreds({ email, password });
        setNeedsTotp(true);
        setError('Enter the 6-digit code from your authenticator app.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#111114]">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center space-y-8 px-6 py-16">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#111114]">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Ferio Platform Admin</h1>
          <p className="text-xs text-[#6e6e73]">Ferio staff only — customer accounts use ferio.com.</p>
        </header>

        <form onSubmit={submit} className="space-y-4">
          {!needsTotp ? (
            <>
              <div>
                <label className="eyebrow-label mb-1 block">Staff email</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="admin@ferio.test"
                  defaultValue={creds.email}
                  onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
                  className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-sm outline-none focus:border-[#111114]"
                />
              </div>
              <div>
                <label className="eyebrow-label mb-1 block">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
                  className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-sm outline-none focus:border-[#111114]"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="eyebrow-label block">Two-factor code</label>
              <input
                name="code"
                required
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="000000"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-[#111114]"
              />
              <button
                type="button"
                onClick={() => { setNeedsTotp(false); setError(null); }}
                className="text-[11px] text-[#6e6e73] underline hover:text-[#111114]"
              >
                Use a different account
              </button>
            </div>
          )}

          {error && (
            <p className={`text-xs ${/authenticator/i.test(error) ? 'text-[#6e6e73]' : 'text-rose-700'}`}>
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-pill-primary w-full py-3 text-sm disabled:opacity-50">
            {busy ? 'Signing in…' : needsTotp ? 'Verify code' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
