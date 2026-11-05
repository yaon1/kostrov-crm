import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { Profile } from '../types/database';

export type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}

/** Профиль текущего пользователя внутри защищённых маршрутов. */
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe вне защищённого маршрута');
  return profile;
}
