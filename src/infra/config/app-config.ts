/**
 * SindiFlow — Configuração de ambiente
 * Camada: Infra (Frameworks & Drivers)
 *
 * Centraliza a leitura das variáveis `EXPO_PUBLIC_*`.
 *
 * Em desenvolvimento/teste, credenciais ausentes caem em placeholders
 * explícitos: o app precisa bootar e linkar os módulos nativos antes de o
 * responsável provisionar Supabase/Google. Em produção, ausência é erro fatal —
 * um app publicado não pode fingir que tem backend.
 */

export interface ConfiguracaoApp {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleWebClientId: string;
  googleIosClientId?: string;
  usandoPlaceholders: boolean;
}

export class ConfiguracaoAusenteError extends Error {
  constructor(variaveis: string[]) {
    super(
      `Configuração ausente em produção: ${variaveis.join(', ')}. ` +
        'Defina as variáveis EXPO_PUBLIC_* no build.'
    );
    this.name = 'ConfiguracaoAusenteError';
  }
}

const PLACEHOLDERS = {
  supabaseUrl: 'https://placeholder.supabase.co',
  supabaseAnonKey: 'placeholder-anon-key',
  googleWebClientId: 'placeholder.apps.googleusercontent.com',
};

export function carregarConfiguracao(
  env: NodeJS.ProcessEnv = process.env
): ConfiguracaoApp {
  const supabaseUrl = texto(env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = texto(env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const googleWebClientId = texto(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const googleIosClientId = texto(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

  const ausentes: string[] = [];
  if (!supabaseUrl) ausentes.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) ausentes.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!googleWebClientId) ausentes.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

  if (ausentes.length > 0 && emProducao(env)) {
    throw new ConfiguracaoAusenteError(ausentes);
  }

  if (ausentes.length > 0 && emDesenvolvimento(env)) {
    console.warn(
      `[SindiFlow] Credenciais ausentes (${ausentes.join(', ')}). ` +
        'Usando placeholders de desenvolvimento: o boot e o link nativo funcionam, ' +
        'mas login real e sincronização não.'
    );
  }

  return {
    supabaseUrl: supabaseUrl ?? PLACEHOLDERS.supabaseUrl,
    supabaseAnonKey: supabaseAnonKey ?? PLACEHOLDERS.supabaseAnonKey,
    googleWebClientId: googleWebClientId ?? PLACEHOLDERS.googleWebClientId,
    googleIosClientId,
    usandoPlaceholders: ausentes.length > 0,
  };
}

function texto(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo : undefined;
}

function emProducao(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV ?? process.env.NODE_ENV) === 'production';
}

function emDesenvolvimento(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV ?? process.env.NODE_ENV) === 'development';
}
