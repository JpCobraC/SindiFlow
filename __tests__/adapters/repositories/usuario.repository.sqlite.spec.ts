/**
 * Testes de mapeamento do UsuarioRepositorySQLite contra SQLiteExecutorFake.
 *
 * Valida salvar, buscar por id, buscar por email, listar por condomínio,
 * desativar e reativar.
 */
import { UsuarioRepositorySQLite } from '../../../src/adapters/repositories/usuario.repository.sqlite';
import { SQLiteExecutorFake } from '../../../src/adapters/repositories/sqlite-executor.fake';
import { RoleUsuario } from '../../../src/domain/interfaces/auth.gateway.interface';

function criarUsuarioDados(props?: Partial<{
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominioId: string;
  ativo: boolean;
}>): ReturnType<typeof import('../../../src/domain/interfaces/usuario.repository.interface')['salvar'] extends never ? any : any> & {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominioId: string;
  unidade?: string;
  registroProfissional?: string;
  ativo: boolean;
  ultimoAcesso?: Date;
  criadoEm: Date;
} {
  const agora = new Date();
  return {
    id: props?.id ?? 'usr-1',
    nome: props?.nome ?? 'Usuário Teste',
    email: props?.email ?? 'teste@exemplo.com',
    role: props?.role ?? 'SINDICO',
    condominioId: props?.condominioId ?? 'cond-1',
    unidade: 'Apto 101',
    ativo: props?.ativo ?? true,
    ultimoAcesso: agora,
    criadoEm: agora,
  };
}

describe('UsuarioRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: UsuarioRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new UsuarioRepositorySQLite(executor);
  });

  it('deve salvar e buscar usuário por id', async () => {
    const usuario = criarUsuarioDados({ id: 'usr-1', email: 'teste@exemplo.com' });

    await repo.salvar(usuario as any);
    const encontrado = await repo.buscarPorId('usr-1');

    expect(encontrado).not.toBeNull();
    expect(encontrado?.id).toBe('usr-1');
    expect(encontrado?.email).toBe('teste@exemplo.com');
    expect(encontrado?.role).toBe('SINDICO');
  });

  it('deve retornar null quando usuário não existe', async () => {
    const encontrado = await repo.buscarPorId('inexistente');
    expect(encontrado).toBeNull();
  });

  it('deve buscar usuário por email', async () => {
    const usuario = criarUsuarioDados({
      id: 'usr-1',
      email: 'teste@exemplo.com',
    });
    await repo.salvar(usuario as any);

    const encontrado = await repo.buscarPorEmail('teste@exemplo.com');
    expect(encontrado).not.toBeNull();
    expect(encontrado?.id).toBe('usr-1');

    const naoEncontrado = await repo.buscarPorEmail('outro@exemplo.com');
    expect(naoEncontrado).toBeNull();
  });

  it('deve listar usuários por condomínio', async () => {
    const u1 = criarUsuarioDados({
      id: 'usr-1',
      condominioId: 'cond-A',
      email: 'a@exemplo.com',
    });
    const u2 = criarUsuarioDados({
      id: 'usr-2',
      condominioId: 'cond-B',
      email: 'b@exemplo.com',
    });
    const u3 = criarUsuarioDados({
      id: 'usr-3',
      condominioId: 'cond-A',
      email: 'c@exemplo.com',
    });

    await repo.salvar(u1 as any);
    await repo.salvar(u2 as any);
    await repo.salvar(u3 as any);

    const condA = await repo.listarPorCondominio('cond-A');
    expect(condA).toHaveLength(2);
    expect(condA.map((u) => u.id)).toContain('usr-1');
    expect(condA.map((u) => u.id)).toContain('usr-3');

    const condB = await repo.listarPorCondominio('cond-B');
    expect(condB).toHaveLength(1);
    expect(condB[0]?.id).toBe('usr-2');
  });

  it('deve desativar e reativar usuário', async () => {
    const usuario = criarUsuarioDados({ id: 'usr-1', ativo: true });
    await repo.salvar(usuario as any);

    await repo.desativar('usr-1');
    const desativado = await repo.buscarPorId('usr-1');
    expect(desativado?.ativo).toBe(false);

    await repo.reativar('usr-1');
    const reativado = await repo.buscarPorId('usr-1');
    expect(reativado?.ativo).toBe(true);
  });

  it('deve salvar e atualizar usuário existente (upsert)', async () => {
    const usuario = criarUsuarioDados({
      id: 'usr-upd',
      nome: 'Nome Original',
    });
    await repo.salvar(usuario as any);

    const atualizado = criarUsuarioDados({
      id: 'usr-upd',
      nome: 'Nome Atualizado',
      email: 'novo@exemplo.com',
    });
    await repo.salvar(atualizado as any);

    const encontrado = await repo.buscarPorId('usr-upd');
    expect(encontrado?.nome).toBe('Nome Atualizado');
    expect(encontrado?.email).toBe('novo@exemplo.com');
  });
});
