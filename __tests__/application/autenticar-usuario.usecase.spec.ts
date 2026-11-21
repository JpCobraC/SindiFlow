/**
 * Testes do AutenticarUsuarioUseCase.
 *
 * O caso de uso orquestra a porta de autenticação (Supabase), a porta nativa
 * do Google e a persistência local. `usuarioNovo` é decidido pelo repositório
 * local, nunca pelo provedor remoto — o Supabase não informa isso de forma
 * confiável no login.
 */
import { AutenticarUsuarioUseCase } from '../../src/application/use-cases/autenticar-usuario.usecase';
import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import {
  AuthGateway,
  GoogleSignInGateway,
  SessaoUsuario,
} from '../../src/domain/interfaces/auth.gateway.interface';
import {
  UsuarioDados,
  UsuarioRepository,
} from '../../src/domain/interfaces/usuario.repository.interface';
import { AutenticacaoCanceladaError } from '../../src/domain/errors/domain-errors';

const AGORA = new Date('2026-11-20T12:00:00.000Z');
const CRIADO_EM = new Date('2026-01-10T09:00:00.000Z');

function criarSessao(overrides?: Partial<SessaoUsuario>): SessaoUsuario {
  return {
    id: 'usr-1',
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
    role: 'SINDICO',
    condominioId: 'cond-1',
    unidade: 'Apto 101',
    expiraEm: new Date(AGORA.getTime() + 7 * 24 * 60 * 60 * 1000),
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    ...overrides,
  };
}

function criarUsuarioDados(overrides?: Partial<UsuarioDados>): UsuarioDados {
  return {
    id: 'usr-1',
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
    role: 'SINDICO',
    condominioId: 'cond-1',
    unidade: 'Apto 101',
    ativo: true,
    ultimoAcesso: new Date('2026-11-01T10:00:00.000Z'),
    criadoEm: CRIADO_EM,
    ...overrides,
  };
}

class AuthGatewayFake implements AuthGateway {
  sessao = criarSessao();
  erro: Error | null = null;

  loginPorEmail = jest.fn(async (_email: string, _senha: string) => {
    if (this.erro) throw this.erro;
    return this.sessao;
  });

  loginComIdToken = jest.fn(async (_idToken: string) => {
    if (this.erro) throw this.erro;
    return this.sessao;
  });

  renovarSessao = jest.fn(async (_refreshToken: string) => this.sessao);
  logout = jest.fn(async () => undefined);
  obterSessaoSalva = jest.fn(async (): Promise<SessaoUsuario | null> => this.sessao);
  temSessaoValida = jest.fn(async () => true);
}

class GoogleSignInGatewayFake implements GoogleSignInGateway {
  idToken: string | null = 'google-id-token';

  obterIdToken = jest.fn(async () => this.idToken);
}

class UsuarioRepositoryFake implements UsuarioRepository {
  usuarios = new Map<string, UsuarioDados>();

  salvar = jest.fn(async (usuario: UsuarioDados) => {
    this.usuarios.set(usuario.id, usuario);
  });

  buscarPorId = jest.fn(async (id: string) => this.usuarios.get(id) ?? null);

  buscarPorEmail = jest.fn(async (email: string) => {
    for (const usuario of this.usuarios.values()) {
      if (usuario.email === email) return usuario;
    }
    return null;
  });

  listarPorCondominio = jest.fn(async (condominioId: string) =>
    Array.from(this.usuarios.values()).filter((u) => u.condominioId === condominioId)
  );

  desativar = jest.fn(async (id: string) => {
    const usuario = this.usuarios.get(id);
    if (usuario) usuario.ativo = false;
  });

  reativar = jest.fn(async (id: string) => {
    const usuario = this.usuarios.get(id);
    if (usuario) usuario.ativo = true;
  });
}

describe('AutenticarUsuarioUseCase', () => {
  let authGateway: AuthGatewayFake;
  let googleGateway: GoogleSignInGatewayFake;
  let usuarioRepo: UsuarioRepositoryFake;
  let outboxRepo: OutboxRepositoryInMemory;
  let useCase: AutenticarUsuarioUseCase;

  beforeEach(() => {
    authGateway = new AuthGatewayFake();
    googleGateway = new GoogleSignInGatewayFake();
    usuarioRepo = new UsuarioRepositoryFake();
    outboxRepo = new OutboxRepositoryInMemory();
    useCase = new AutenticarUsuarioUseCase(
      authGateway,
      googleGateway,
      usuarioRepo,
      outboxRepo,
      'device-teste',
      () => AGORA
    );
  });

  it('autentica por e-mail, normaliza o e-mail e preserva criadoEm existente', async () => {
    const existente = criarUsuarioDados();
    await usuarioRepo.salvar(existente);

    const usuario = await useCase.executar({
      metodo: 'email',
      email: '  Teste@Exemplo.com ',
      senha: 'senha-123',
    });

    expect(authGateway.loginPorEmail).toHaveBeenCalledWith('teste@exemplo.com', 'senha-123');
    expect(usuarioRepo.salvar).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'usr-1',
        criadoEm: CRIADO_EM,
        ultimoAcesso: AGORA,
      })
    );
    expect(usuario.role).toBe('SINDICO');

    // §1.3: a atualização de último acesso também é escrita local e precisa
    // passar pela outbox — como UPDATE, não como INSERT.
    const eventos = await outboxRepo.listarTodos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tabela: 'users',
      operacao: 'UPDATE',
      idRegistro: 'usr-1',
      deviceId: 'device-teste',
    });
  });

  it('cria usuário novo com criadoEm determinístico e enfileira INSERT na outbox', async () => {
    await useCase.executar({
      metodo: 'email',
      email: 'teste@exemplo.com',
      senha: 'senha-123',
    });

    expect(usuarioRepo.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ criadoEm: AGORA, ultimoAcesso: AGORA })
    );

    const eventos = await outboxRepo.listarTodos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tabela: 'users',
      operacao: 'INSERT',
      idRegistro: 'usr-1',
      usuarioId: 'usr-1',
    });
  });

  it('autentica com Google usando o idToken nativo e sem chamar login por e-mail', async () => {
    await useCase.executar({ metodo: 'google' });

    expect(googleGateway.obterIdToken).toHaveBeenCalledTimes(1);
    expect(authGateway.loginComIdToken).toHaveBeenCalledWith('google-id-token');
    expect(authGateway.loginPorEmail).not.toHaveBeenCalled();
  });

  it('trata cancelamento do Google como erro tipado e não persiste usuário', async () => {
    googleGateway.idToken = null;

    await expect(useCase.executar({ metodo: 'google' })).rejects.toBeInstanceOf(
      AutenticacaoCanceladaError
    );

    expect(authGateway.loginComIdToken).not.toHaveBeenCalled();
    expect(usuarioRepo.salvar).not.toHaveBeenCalled();
  });

  it('propaga erro do provedor sem salvar usuário', async () => {
    authGateway.erro = new Error('credenciais inválidas');

    await expect(
      useCase.executar({ metodo: 'email', email: 'teste@exemplo.com', senha: 'errada' })
    ).rejects.toThrow('credenciais inválidas');

    expect(usuarioRepo.salvar).not.toHaveBeenCalled();
  });

  it('restaura sessão salva e devolve o usuário local', async () => {
    await usuarioRepo.salvar(criarUsuarioDados());

    const usuario = await useCase.restaurarSessao();

    expect(authGateway.obterSessaoSalva).toHaveBeenCalledTimes(1);
    expect(usuario?.id).toBe('usr-1');
    expect(await outboxRepo.listarTodos()).toHaveLength(0);
  });

  it('devolve null quando não há sessão salva', async () => {
    authGateway.obterSessaoSalva.mockResolvedValueOnce(null);

    await expect(useCase.restaurarSessao()).resolves.toBeNull();
  });

  it('encerra a sessão no gateway', async () => {
    await useCase.encerrarSessao();

    expect(authGateway.logout).toHaveBeenCalledTimes(1);
  });
});
