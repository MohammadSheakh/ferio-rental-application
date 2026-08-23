'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (r: { credential: string }) => void;
          }): void;
          renderButton(el: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const googleHostRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in → home.
  useEffect(() => {
    if (auth.ready && auth.token) router.replace('/');
  }, [auth.ready, auth.token, router]);

  const afterAuth = useCallback(() => router.replace('/'), [router]);

  const onPasswordSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setBusy(true);
      setError(null);
      try {
        if (mode === 'login') {
          await auth.loginWithPassword(String(f.get('email')), String(f.get('password')));
        } else {
          await auth.registerWithPassword(
            String(f.get('email')),
            String(f.get('password')),
            String(f.get('displayName')),
          );
        }
        afterAuth();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
        setBusy(false);
      }
    },
    [mode, auth, afterAuth],
  );

  // Google Identity Services — one-tap style button.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const el = googleHostRef.current;
    if (!el || window.google?.accounts?.id) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (r) => {
          setBusy(true);
          setError(null);
          try {
            await auth.loginWithGoogleCredential(r.credential);
            afterAuth();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
          } finally {
            setBusy(false);
          }
        },
      });
      const gsi = window.google;
      if (!gsi) return;
      gsi.accounts.id.renderButton(el, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      });
    };
    document.head.appendChild(script);
  }, [auth, afterAuth]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-md items-center px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">
              F
            </div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-6 py-16">
        <header className="space-y-2">
          <p className="eyebrow-label">Account</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'login' ? 'Sign in to Ferio' : 'Create your account'}
          </h1>
          <p className="text-sm leading-relaxed text-[#6e6e73]">
            One account for posting property and managing rentals.
          </p>
        </header>

        {/* Google */}
        {GOOGLE_CLIENT_ID ? (
          <div className="flex justify-center" ref={googleHostRef} />
        ) : (
          <p className="rounded-[10px] border border-[#e8e8ea] p-3 text-center text-xs text-[#6e6e73]">
            Google sign-in is not configured.
          </p>
        )}

        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[#e8e8ea]" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]">or</span>
          <span className="h-px flex-1 bg-[#e8e8ea]" />
        </div>

        {/* Email / password */}
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="eyebrow-label mb-1 block">Full name</label>
              <input
                name="displayName"
                required
                placeholder="Your name"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-sm outline-none focus:border-[#111114]"
              />
            </div>
          )}
          <div>
            <label className="eyebrow-label mb-1 block">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-sm outline-none focus:border-[#111114]"
            />
          </div>
          <div>
            <label className="eyebrow-label mb-1 block">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-3 text-sm outline-none focus:border-[#111114]"
            />
          </div>

          {error && <p className="text-xs text-rose-700">{error}</p>}

          <button type="submit" disabled={busy} className="btn-pill-primary w-full py-3 text-sm disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-[#6e6e73]">
          {mode === 'login' ? (
            <>
              New to Ferio?{' '}
              <button onClick={() => setMode('register')} className="font-medium underline hover:text-[#111114]">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="font-medium underline hover:text-[#111114]">
                Sign in
              </button>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
