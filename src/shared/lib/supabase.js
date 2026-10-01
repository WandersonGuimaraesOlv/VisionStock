// src/shared/lib/supabase.js — Cliente Supabase (BaaS).
// Sem as variáveis de ambiente o app continua funcionando offline (supabase = null).
import { createClient } from '@supabase/supabase-js';
import { config } from '../../app/config';

export const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

if (!supabase) {
  console.error('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes: operando somente offline.');
}
