import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (см. .env.example)');
}

export const supabase = createClient<Database>(url, anonKey);
