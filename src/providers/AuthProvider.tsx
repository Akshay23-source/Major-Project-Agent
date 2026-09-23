import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  initialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setInitialized(true);
    });

    // 2. Listen for auth changes (login/logout/refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    // Check if the user is currently on an auth screen
    const currentSegments = segments as string[];
    const isRoot = currentSegments.length === 0;
    const inAuthGroup = currentSegments.length > 0 && currentSegments[0] === '(auth)';

    if (!session && !inAuthGroup && !isRoot) {
      // Unauthenticated user trying to access protected screens -> redirect to splash or login
      router.replace('/');
    } else if (session && (inAuthGroup || isRoot)) {
      // Authenticated user trying to access auth screens -> redirect to agent dashboard
      router.replace('/dashboard');
    }
  }, [session, initialized, segments]);

  return (
    <AuthContext.Provider value={{ session, user, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
