/**
 * Testes para SessionStorageSecureStore (FA 4.5)
 *
 * Mockamos expo-secure-store pois não há Keychain/Keystore nos testes Jest.
 * Testa salvar, ler e remover token de sessão de forma segura.
 * Conformidade com §1.2: nunca AsyncStorage.
 */
jest.mock('expo-secure-store', () => {
  const storage: Map<string, string> = new Map();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => {
      return storage.get(key) ?? null;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
    __storage: storage,
    __reset: () => {
      storage.clear();
    },
  };
});

import * as SecureStore from 'expo-secure-store';
import { SessionStorageSecureStore } from '../../../src/adapters/auth/session-storage.secure-store';
import { SessaoUsuario } from '../../../src/domain/interfaces/auth.gateway.interface';

const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

const sessaoExemplo: SessaoUsuario = {
  id: 'usr-1',
  nome: 'Usuário Teste',
  email: 'teste@exemplo.com',
  role: 'SINDICO',
  condominioId: 'cond-1',
  expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  accessToken: 'token-acesso-123',
  refreshToken: 'token-refresh-456',
};

describe('SessionStorageSecureStore', () => {
  let storage: SessionStorageSecureStore;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as any).__reset();
    storage = new SessionStorageSecureStore();
  });

  it('deve salvar sessão no SecureStore', async () => {
    await storage.salvarSessao(sessaoExemplo);

    expect(mockSetItem).toHaveBeenCalledWith(
      'sessao_usuario',
      expect.stringContaining('usr-1')
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      'sessao_expira_em',
      sessaoExemplo.expiraEm.toISOString()
    );
  });

  it('deve ler sessão do SecureStore', async () => {
    await storage.salvarSessao(sessaoExemplo);

    const lida = await storage.obterSessao();

    expect(lida).not.toBeNull();
    expect(lida?.id).toBe('usr-1');
    expect(lida?.email).toBe('teste@exemplo.com');
    expect(lida?.role).toBe('SINDICO');
  });

  it('deve retornar null quando não há sessão salva', async () => {
    const lida = await storage.obterSessao();
    expect(lida).toBeNull();
  });

  it('deve remover sessão ao fazer logout', async () => {
    await storage.salvarSessao(sessaoExemplo);
    await storage.removerSessao();

    expect(mockDeleteItem).toHaveBeenCalledWith('sessao_usuario');
    expect(mockDeleteItem).toHaveBeenCalledWith('sessao_expira_em');
  });

  it('deve verificar se sessão está expirada', async () => {
    const sessaoExpirada: SessaoUsuario = {
      ...sessaoExemplo,
      expiraEm: new Date(Date.now() - 1000), // já expirou
    };
    await storage.salvarSessao(sessaoExpirada);

    const expirada = await storage.estaExpirada();
    expect(expirada).toBe(true);
  });

  it('deve retornar false quando sessão não expirou', async () => {
    const sessaoValida: SessaoUsuario = {
      ...sessaoExemplo,
      expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    await storage.salvarSessao(sessaoValida);

    const expirada = await storage.estaExpirada();
    expect(expirada).toBe(false);
  });
});
