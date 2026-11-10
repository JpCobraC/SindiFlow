/**
 * SindiFlow — Cliente Supabase
 * Camada: Infra (Frameworks & Drivers)
 *
 * Cria e exporta o cliente Supabase configurado com URL e anon key.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 * Conformidade com §1.3: todo sync passa pelo SyncGatewaySupabase,
 * nunca direto no cliente de fora da camada de adapters.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cria o cliente Supabase com a URL e anon key informadas.
 *
 * @param supabaseUrl URL do projeto Supabase
 * @param supabaseAnonKey Anon key do projeto Supabase
 * @returns Instância configurada do cliente Supabase
 */
export function criarSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}
