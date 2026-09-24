import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { Session, loadSession, onSessionChange } from '../lib/api';

type AuthContextType = {
  session: Session | null;
  user: Session['user'] | null;
  role: Session['role'] | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  initialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 1. Restore the stored session (JWT from the Agri Agent backend)
    loadSession().then((s) => {
      setSession(s);
      setInitialized(true);
    });

    // 2. Follow sign-in / sign-out / expired-token changes
    return onSessionChange(setSession);
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const currentSegments = segments as string[];
    const isRoot = currentSegments.length === 0;
    const inAuthGroup = currentSegments.length > 0 && currentSegments[0] === '(auth)';
    const inDriverGroup = currentSegments.length > 0 && currentSegments[0] === '(driver)';

    if (!session && !inAuthGroup && !isRoot) {
      // Unauthenticated user on a protected screen → splash / login
      router.replace('/');
    } else if (session && (inAuthGroup || isRoot)) {
      // Signed in → the right home for the role
      router.replace(session.role === 'driver' ? '/(driver)/dashboard' : '/dashboard');
    } else if (session?.role === 'driver' && !inDriverGroup && !inAuthGroup && !isRoot) {
      // Drivers only use the driver app
      router.replace('/(driver)/dashboard');
    }
  }, [session, initialized, segments]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role: session?.role ?? null, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
