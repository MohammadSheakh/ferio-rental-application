'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'ferio_identity';

export interface IdentityUser {
  userId: string;
  email: string;
  displayName: string;
}

interface StoredIdentity {
  token: string;
  refreshToken?: string;
  user: IdentityUser;
}

interface AuthContextValue {
  token: string;
  user: IdentityUser | undefined;
  ready: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null as never);

function read(): StoredIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
  }, []);

  const persist = useCallback((next: StoredIdentity | null) => {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
    setState(next);
  }, []);

  const callIdentity = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<StoredIdentity> => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1'}${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Authentication failed');
      const data = json.data ?? json;
      const stored: StoredIdentity = { token: data.token, user: data.user };
      persist(stored);
      return stored;
    },
    [persist],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...(state ?? { token: '', user: undefined as never }),
      ready,
      loginWithPassword: (email, password) =>
        callIdentity('/identity/login', { email, password }).then(() => {}),
      registerWithPassword: (email, password, displayName) =>
        callIdentity('/identity/register', { email, password, displayName }).then(() => {}),
      loginWithGoogleCredential: (credential) =>
        callIdentity('/identity/google', { credential }).then(() => {}),
      logout: () => {
        // Best-effort server revocation of the refresh token.
        if (state?.refreshToken) {
          void fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1'}/identity/logout`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: state.refreshToken }),
            },
          ).catch(() => {});
        }
        persist(null);
      },
    }),
    [state, ready, callIdentity, persist],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
