/**
 * SindiFlow — Configuração de ambiente
 * Camada: Infra (Frameworks & Drivers)
 *
 * Centraliza a leitura das variáveis `EXPO_PUBLIC_*`.
 *
 * Em desenvolvimento/teste, credenciais ausentes caem em placeholders
 * explícitos: o app precisa bootar e linkar os módulos nativos antes de o
 * responsável provisionar o Supabase. Em produção, as credenciais do Supabase
 * são obrigatórias (ausência é erro fatal), enquanto as credenciais do Google
 * Sign-In são opcionais.
 *
 * IMPORTANTE: As variáveis `EXPO_PUBLIC_*` precisam ser lidas com notação de
 * ponto literal (`process.env.EXPO_PUBLIC_*`) para que o Metro/Babel faça o
 * inlining estático no bundle de produção.
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
  env?: NodeJS.ProcessEnv
): ConfiguracaoApp {
  const origem = env ?? lerEnvNativo();
  const supabaseUrl = texto(origem.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = texto(origem.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const googleWebClientId = texto(origem.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const googleIosClientId = texto(origem.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

  const ausentes: string[] = [];
  if (!supabaseUrl) ausentes.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) ausentes.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (ausentes.length > 0 && emProducao(origem)) {
    throw new ConfiguracaoAusenteError(ausentes);
  }

  if (ausentes.length > 0 && emDesenvolvimento(origem)) {
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

/**
 * Lê as variáveis `EXPO_PUBLIC_*` com notação de ponto literal para que o
 * `babel-preset-expo` / Metro consiga fazer o inlining estático no bundle.
 */
function lerEnvNativo(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
