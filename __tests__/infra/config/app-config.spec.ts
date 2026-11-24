/**
 * Testes da configuração de ambiente.
 * O contrato que importa: dev/teste boota com placeholders explícitos;
 * produção falha em vez de silenciosamente apontar para um backend falso.
 */
import {
  carregarConfiguracao,
  ConfiguracaoAusenteError,
} from '../../../src/infra/config/app-config';

describe('carregarConfiguracao', () => {
  const nodeEnvOriginal = process.env.NODE_ENV;
  const supabaseUrlOriginal = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKeyOriginal = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
    if (supabaseUrlOriginal === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrlOriginal;
    }
    if (supabaseAnonKeyOriginal === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKeyOriginal;
    }
    jest.restoreAllMocks();
  });

  it('lê e normaliza as variáveis completas', () => {
    const config = carregarConfiguracao({
      NODE_ENV: 'test',
      EXPO_PUBLIC_SUPABASE_URL: '  https://projeto.supabase.co  ',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-real',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '456.apps.googleusercontent.com',
    } as NodeJS.ProcessEnv);

    expect(config.supabaseUrl).toBe('https://projeto.supabase.co');
    expect(config.supabaseAnonKey).toBe('anon-key-real');
    expect(config.googleWebClientId).toBe('123.apps.googleusercontent.com');
    expect(config.googleIosClientId).toBe('456.apps.googleusercontent.com');
    expect(config.usandoPlaceholders).toBe(false);
  });

  it('em desenvolvimento usa placeholders e avisa uma vez', () => {
    process.env.NODE_ENV = 'development';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = carregarConfiguracao({} as NodeJS.ProcessEnv);

    expect(config.usandoPlaceholders).toBe(true);
    expect(config.supabaseUrl).toBe('https://placeholder.supabase.co');
    expect(config.googleWebClientId).toContain('apps.googleusercontent.com');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('em teste usa placeholders sem poluir o console', () => {
    process.env.NODE_ENV = 'test';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = carregarConfiguracao({} as NodeJS.ProcessEnv);

    expect(config.usandoPlaceholders).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('em produção falha listando todas as variáveis ausentes', () => {
    process.env.NODE_ENV = 'production';

    expect(() => carregarConfiguracao({} as NodeJS.ProcessEnv)).toThrow(
      ConfiguracaoAusenteError
    );
    expect(() => carregarConfiguracao({} as NodeJS.ProcessEnv)).toThrow(
      /EXPO_PUBLIC_SUPABASE_URL.*EXPO_PUBLIC_SUPABASE_ANON_KEY/
    );
  });

  it('em produção aceita apenas credenciais do Supabase sem EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', () => {
    process.env.NODE_ENV = 'production';

    const config = carregarConfiguracao({
      NODE_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://projeto.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-real',
    } as NodeJS.ProcessEnv);

    expect(config.supabaseUrl).toBe('https://projeto.supabase.co');
    expect(config.supabaseAnonKey).toBe('anon-key-real');
    expect(config.googleWebClientId).toBe('placeholder.apps.googleusercontent.com');
    expect(config.usandoPlaceholders).toBe(false);
  });

  it('lê process.env com notação literal quando chamado sem argumentos', () => {
    process.env.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://nativo.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-nativo';

    const config = carregarConfiguracao();

    expect(config.supabaseUrl).toBe('https://nativo.supabase.co');
    expect(config.supabaseAnonKey).toBe('anon-nativo');
    expect(config.usandoPlaceholders).toBe(false);
  });
});
