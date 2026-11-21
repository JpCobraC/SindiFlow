/**
 * Testes do adapter de armazenamento do Supabase.
 *
 * O SDK guarda a sessão inteira (access token + refresh token + metadata) em
 * um único valor. No iOS, o Keychain pode recusar valores acima de ~2 KB, então
 * o adapter divide o payload em chunks e mantém um manifesto com a contagem.
 * Também preserva a leitura do formato antigo (valor único) para não perder a
 * sessão de quem atualiza o app.
 */
const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

jest.mock('expo-secure-store', () => mockSecureStore);

import { SupabaseAuthStorage } from '../../../src/adapters/auth/supabase-auth-storage.secure-store';

const PREFIXO = 'sindiflow.supabase.auth.';

function criarSecureStoreEmMemoria() {
  const valores = new Map<string, string>();

  mockSecureStore.getItemAsync.mockImplementation(async (chave: string) => {
    return valores.get(chave) ?? null;
  });
  mockSecureStore.setItemAsync.mockImplementation(
    async (chave: string, valor: string) => {
      valores.set(chave, valor);
    }
  );
  mockSecureStore.deleteItemAsync.mockImplementation(async (chave: string) => {
    valores.delete(chave);
  });

  return valores;
}

describe('SupabaseAuthStorage', () => {
  let storage: SupabaseAuthStorage;
  let valores: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    valores = criarSecureStoreEmMemoria();
    storage = new SupabaseAuthStorage();
  });

  it('lê do SecureStore com prefixo do app', async () => {
    valores.set(`${PREFIXO}sessao`, '{"access_token":"abc"}');

    await expect(storage.getItem('sessao')).resolves.toBe('{"access_token":"abc"}');
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      `${PREFIXO}sessao`
    );
  });

  it('grava valores pequenos em um único chunk e remove o formato antigo', async () => {
    await storage.setItem('sessao', '{"access_token":"abc"}');

    expect(valores.get(`${PREFIXO}meta.sessao`)).toBe('1');
    expect(valores.get(`${PREFIXO}chunk.sessao.0`)).toBe('{"access_token":"abc"}');
    expect(valores.has(`${PREFIXO}sessao`)).toBe(false);
    await expect(storage.getItem('sessao')).resolves.toBe('{"access_token":"abc"}');
  });

  it('divide valores grandes e remonta na leitura', async () => {
    const valor = 'a'.repeat(1_000);

    await storage.setItem('sessao', valor);

    expect(valores.get(`${PREFIXO}meta.sessao`)).toBe('3');
    expect(valores.get(`${PREFIXO}chunk.sessao.0`)).toHaveLength(480);
    expect(valores.get(`${PREFIXO}chunk.sessao.1`)).toHaveLength(480);
    expect(valores.get(`${PREFIXO}chunk.sessao.2`)).toHaveLength(40);
    await expect(storage.getItem('sessao')).resolves.toBe(valor);
  });

  it('substitui chunks antigos quando o novo valor é menor', async () => {
    await storage.setItem('sessao', 'a'.repeat(1_000));
    await storage.setItem('sessao', 'curto');

    expect(valores.has(`${PREFIXO}chunk.sessao.1`)).toBe(false);
    expect(valores.has(`${PREFIXO}chunk.sessao.2`)).toBe(false);
    await expect(storage.getItem('sessao')).resolves.toBe('curto');
  });

  it('retorna null quando um chunk desapareceu', async () => {
    await storage.setItem('sessao', 'a'.repeat(1_000));
    valores.delete(`${PREFIXO}chunk.sessao.1`);

    await expect(storage.getItem('sessao')).resolves.toBeNull();
  });

  it('remove manifesto, chunks e o valor antigo', async () => {
    await storage.setItem('sessao', 'a'.repeat(1_000));
    valores.set(`${PREFIXO}sessao`, 'formato-antigo');

    await storage.removeItem('sessao');

    expect(valores.has(`${PREFIXO}meta.sessao`)).toBe(false);
    expect(valores.has(`${PREFIXO}chunk.sessao.0`)).toBe(false);
    expect(valores.has(`${PREFIXO}chunk.sessao.1`)).toBe(false);
    expect(valores.has(`${PREFIXO}chunk.sessao.2`)).toBe(false);
    expect(valores.has(`${PREFIXO}sessao`)).toBe(false);
  });

  it('retorna null quando não existe nem manifesto nem valor antigo', async () => {
    await expect(storage.getItem('inexistente')).resolves.toBeNull();
  });

  it('ignora manifesto corrompido e tenta o formato antigo', async () => {
    valores.set(`${PREFIXO}meta.sessao`, 'corrompido');
    valores.set(`${PREFIXO}sessao`, 'formato-antigo');

    await expect(storage.getItem('sessao')).resolves.toBe('formato-antigo');
  });

  it('rejeita payload acima do limite de segurança', async () => {
    await expect(storage.setItem('sessao', 'a'.repeat(40_000))).rejects.toThrow(
      /excede o limite/
    );
  });
});
