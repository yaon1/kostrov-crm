import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { unwrap } from '../api/client';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthState } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profiles', 'me', userId],
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('*').eq('id', userId!).single()),
  });

  const value: AuthState = {
    session,
    profile: profileQuery.data ?? null,
    loading: sessionLoading || (Boolean(userId) && profileQuery.isPending),
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear(); // не оставляем в кэше данные предыдущего пользователя
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
