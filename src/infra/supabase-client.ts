/**
 * SindiFlow — Fábrica do cliente Supabase
 * Camada: Infra (Frameworks & Drivers)
 *
 * Um único cliente é compartilhado por auth e sync. Isso garante que o token
 * da sessão autenticada seja usado nas escritas e que o RLS veja o usuário
 * correto — em vez de um cliente anônimo separado.
 */

import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';

export function criarClienteSupabase(
  url: string,
  anonKey: string,
  storage: SupportedStorage
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // Não há URL de callback: o Google troca idToken no dispositivo.
      detectSessionInUrl: false,
    },
  });
}
