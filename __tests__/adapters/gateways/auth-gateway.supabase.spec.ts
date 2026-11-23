/**
 * Testes para AuthGatewaySupabase (FA 4.3)
 *
 * O gateway recebe um cliente Supabase já autenticado; a criação do cliente
 * (e a escolha do armazenamento seguro) é responsabilidade da infraestrutura.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGatewaySupabase } from '../../../src/adapters/gateways/auth-gateway.supabase';
import { SessaoUsuario } from '../../../src/domain/interfaces/auth.gateway.interface';
import {
  SessaoInvalidaError,
} from '../../../src/domain/errors/domain-errors';

const mockAuth = {
  signInWithPassword: jest.fn(),
  signInWithIdToken: jest.fn(),
  refreshSession: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
};

const clienteFake = { auth: mockAuth } as unknown as SupabaseClient;

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

function criarSessaoSupabase(sessao: SessaoUsuario, metadata?: Record<string, unknown>) {
  return {
    access_token: sessao.accessToken,
    refresh_token: sessao.refreshToken,
    expires_at: Math.floor(sessao.expiraEm.getTime() / 1000),
    user: {
      id: sessao.id,
      email: sessao.email,
      user_metadata: {
        nome: sessao.nome,
        role: sessao.role,
        condominio_id: sessao.condominioId,
        ...metadata,
      },
    },
  };
}

describe('AuthGatewaySupabase', () => {
  let gateway: AuthGatewaySupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new AuthGatewaySupabase(clienteFake);
  });

  it('loginPorEmail retorna a sessão mapeada', async () => {
    const sessao = criarSessaoMock();
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: criarSessaoSupabase(sessao).user,
        session: criarSessaoSupabase(sessao),
      },
      error: null,
    });

    const resultado = await gateway.loginPorEmail('teste@exemplo.com', 'senha123');

    expect(resultado.email).toBe('teste@exemplo.com');
    expect(resultado.role).toBe('SINDICO');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'teste@exemplo.com',
      password: 'senha123',
    });
  });

  it('loginPorEmail lança erro quando credenciais são inválidas', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      gateway.loginPorEmail('teste@exemplo.com', 'senhaErrada')
    ).rejects.toThrow('Invalid login credentials');
  });

  it('loginComIdToken troca o token nativo por uma sessão Supabase', async () => {
    const sessao = criarSessaoMock();
    mockAuth.signInWithIdToken.mockResolvedValue({
      data: {
        user: criarSessaoSupabase(sessao).user,
        session: criarSessaoSupabase(sessao),
      },
      error: null,
    });

    const resultado = await gateway.loginComIdToken('google-id-token');

    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
    expect(resultado.id).toBe('usr-1');
  });

  it('loginComIdToken lança erro quando o provedor rejeita o token', async () => {
    mockAuth.signInWithIdToken.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid token' },
    });

    await expect(gateway.loginComIdToken('token-invalido')).rejects.toThrow(
      'Invalid token'
    );
  });

  it('renovarSessao retorna a nova sessão', async () => {
    const novaSessao = criarSessaoMock({ id: 'usr-1' });
    mockAuth.refreshSession.mockResolvedValue({
      data: {
        session: criarSessaoSupabase(novaSessao),
        user: criarSessaoSupabase(novaSessao).user,
      },
      error: null,
    });

    const resultado = await gateway.renovarSessao('token-refresh-456');

    expect(resultado.id).toBe('usr-1');
    expect(resultado.accessToken).toBe(novaSessao.accessToken);
  });

  it('logout chama signOut do Supabase', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    await gateway.logout();

    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('obterSessaoSalva retorna null quando não há sessão', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(gateway.obterSessaoSalva()).resolves.toBeNull();
  });

  it('obterSessaoSalvaBruta retorna a sessão mesmo quando o access token expirou', async () => {
    const expirada = criarSessaoMock({ expiraEm: new Date(Date.now() - 1000) });
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(expirada) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalvaBruta();

    expect(resultado?.id).toBe('usr-1');
    expect(resultado?.expiraEm.getTime()).toBeLessThan(Date.now());
  });

  it('obterSessaoSalva usa o usuário embutido na sessão', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();

    expect(resultado?.id).toBe('usr-1');
    expect(resultado?.email).toBe('teste@exemplo.com');
  });

  it('obterSessaoSalva retorna null quando a sessão salva expirou', async () => {
    const expirada = criarSessaoMock({ expiraEm: new Date(Date.now() - 1000) });
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(expirada) },
      error: null,
    });

    // Uma sessão vencida não pode ser materializada no boot: o app deveria
    // pedir novo login em vez de restaurar um token já inválido.
    await expect(gateway.obterSessaoSalva()).resolves.toBeNull();
  });

  it('temSessaoValida retorna false quando a sessão expirou', async () => {
    const expirada = criarSessaoMock({ expiraEm: new Date(Date.now() - 1000) });
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(expirada) },
      error: null,
    });

    await expect(gateway.temSessaoValida()).resolves.toBe(false);
  });

  it('assume role SINDICO como fallback para role desconhecida ou ausente', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao, { role: 'SUPERADMIN' }) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();
    expect(resultado?.role).toBe('SINDICO');
  });

  it('usa condomínio padrão cond-solar-palmeiras quando metadata não possui condominio_id', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao, { condominio_id: undefined }) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();
    expect(resultado?.condominioId).toBe('cond-solar-palmeiras');
  });

  it('renovarSessao lança erro quando o refresh falha', async () => {
    mockAuth.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'refresh token inválido' },
    });

    await expect(gateway.renovarSessao('token-invalido')).rejects.toThrow(
      'refresh token inválido'
    );
  });

  it('obterSessaoSalvaBruta retorna null quando não há sessão', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(gateway.obterSessaoSalvaBruta()).resolves.toBeNull();
  });

  it('obterSessaoSalva retorna null quando getSession retorna erro', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'erro de rede' },
    });

    await expect(gateway.obterSessaoSalva()).resolves.toBeNull();
  });

  it('temSessaoValida retorna true para sessão válida', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao) },
      error: null,
    });

    await expect(gateway.temSessaoValida()).resolves.toBe(true);
  });

  it('rejeita sessão de usuário sem e-mail', async () => {
    const sessao = criarSessaoMock();
    const supabase = criarSessaoSupabase(sessao);
    mockAuth.getSession.mockResolvedValue({
      data: { session: { ...supabase, user: { ...supabase.user, email: null } } },
      error: null,
    });

    await expect(gateway.obterSessaoSalva()).rejects.toBeInstanceOf(SessaoInvalidaError);
  });

  it('assume role SINDICO quando role não é string no metadata', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao, { role: 42 }) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();
    expect(resultado?.role).toBe('SINDICO');
  });

  it('usa o prefixo do e-mail como nome quando não há metadata de nome', async () => {
    const sessao = criarSessaoMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: criarSessaoSupabase(sessao, { nome: undefined, full_name: undefined }) },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();
    expect(resultado?.nome).toBe('teste');
  });

  it('usa fallback de 7 dias quando session.expires_at é nulo', async () => {
    const sessao = criarSessaoMock();
    const supabase = criarSessaoSupabase(sessao);
    mockAuth.getSession.mockResolvedValue({
      data: { session: { ...supabase, expires_at: null } },
      error: null,
    });

    const resultado = await gateway.obterSessaoSalva();
    expect(resultado).not.toBeNull();
    expect(resultado!.expiraEm.getTime()).toBeGreaterThan(Date.now());
  });

  it('obterSessaoSalvaBruta retorna null quando getSession retorna erro', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'erro' },
    });

    await expect(gateway.obterSessaoSalvaBruta()).resolves.toBeNull();
  });
});
