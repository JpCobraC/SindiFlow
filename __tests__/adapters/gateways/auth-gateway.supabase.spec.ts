/**
 * Testes para AuthGatewaySupabase (FA 4.3)
 *
 * Mockamos @supabase/supabase-js pois não há ambiente de rede nos testes Jest.
 * Testa login por email, renovação de sessão, logout e obtenção de sessão salva.
 */
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      auth: {
        signInWithPassword: jest.fn(),
        signInWithOAuth: jest.fn(),
        refreshSession: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
          })),
        })),
      })),
    })),
  };
});

import { createClient } from '@supabase/supabase-js';
import { AuthGatewaySupabase } from '../../../src/adapters/gateways/auth-gateway.supabase';
import { SessaoUsuario } from '../../../src/domain/interfaces/auth.gateway.interface';

const mockCreateClient = createClient as jest.Mock;

function criarSessaoMock(overrides?: Partial<SessaoUsuario>): SessaoUsuario {
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: 'usr-1',
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
    role: 'SINDICO',
    condominioId: 'cond-1',
    expiraEm,
    accessToken: 'token-acesso-123',
    refreshToken: 'token-refresh-456',
    ...overrides,
  };
}

describe('AuthGatewaySupabase', () => {
  let gateway: AuthGatewaySupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new AuthGatewaySupabase(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('deve criar o cliente Supabase com URL e anon key', () => {
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('loginPorEmail deve retornar sessão com sucesso', async () => {
    const sessao = criarSessaoMock();
    const mockAuth = mockCreateClient().auth;
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: sessao.id,
          email: sessao.email,
          user_metadata: { nome: sessao.nome, role: sessao.role, condominio_id: sessao.condominioId },
        },
        session: {
          access_token: sessao.accessToken,
          refresh_token: sessao.refreshToken,
          expires_at: Math.floor(sessao.expiraEm.getTime() / 1000),
        },
      },
      error: null,
    });

    const resultado = await gateway.loginPorEmail('teste@exemplo.com', 'senha123');

    expect(resultado.usuarioNovo).toBe(false);
    expect(resultado.sessao.email).toBe('teste@exemplo.com');
    expect(resultado.sessao.role).toBe('SINDICO');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'teste@exemplo.com',
      password: 'senha123',
    });
  });

  it('loginPorEmail deve lançar erro quando credenciais inválidas', async () => {
    const mockAuth = mockCreateClient().auth;
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      gateway.loginPorEmail('teste@exemplo.com', 'senhaErrada')
    ).rejects.toThrow();
  });

  it('loginComProvedorSocial deve retornar null quando usuário cancela', async () => {
    const mockAuth = mockCreateClient().auth;
    mockAuth.signInWithOAuth.mockResolvedValue({ data: null, error: null });

    const resultado = await gateway.loginComProvedorSocial('google');

    expect(resultado).toBeNull();
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.any(String) },
    });
  });

  it('renovarSessao deve retornar nova sessão', async () => {
    const novaSessao = criarSessaoMock({ id: 'usr-1' });
    const mockAuth = mockCreateClient().auth;
    mockAuth.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: novaSessao.accessToken,
          refresh_token: novaSessao.refreshToken,
          expires_at: Math.floor(novaSessao.expiraEm.getTime() / 1000),
        },
        user: {
          id: novaSessao.id,
          email: novaSessao.email,
          user_metadata: {
            nome: novaSessao.nome,
            role: novaSessao.role,
            condominio_id: novaSessao.condominioId,
          },
        },
      },
      error: null,
    });

    const resultado = await gateway.renovarSessao('token-refresh-456');

    expect(resultado.id).toBe('usr-1');
    expect(resultado.accessToken).toBe(novaSessao.accessToken);
  });

  it('logout deve chamar signOut do Supabase', async () => {
    const mockAuth = mockCreateClient().auth;
    mockAuth.signOut.mockResolvedValue({ error: null });

    await gateway.logout();

    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('obterSessaoSalva deve retornar null quando não há sessão', async () => {
    const mockAuth = mockCreateClient().auth;
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const sessao = await gateway.obterSessaoSalva();

    expect(sessao).toBeNull();
  });

  it('temSessaoValida deve retornar false quando sessão expirada', async () => {
    const sessaoExpirada = criarSessaoMock({
      expiraEm: new Date(Date.now() - 1000), // já expirou
    });
    const mockAuth = mockCreateClient().auth;
    mockAuth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: sessaoExpirada.accessToken,
          refresh_token: sessaoExpirada.refreshToken,
          expires_at: Math.floor(sessaoExpirada.expiraEm.getTime() / 1000),
        },
        user: {
          id: sessaoExpirada.id,
          email: sessaoExpirada.email,
          user_metadata: {
            nome: sessaoExpirada.nome,
            role: sessaoExpirada.role,
            condominio_id: sessaoExpirada.condominioId,
          },
        },
      },
      error: null,
    });

    const valida = await gateway.temSessaoValida();
    expect(valida).toBe(false);
  });
});
