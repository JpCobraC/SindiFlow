/**
 * Testes de mapeamento do ComunicadoRepositorySQLite contra SQLiteExecutorFake.
 */
import { ComunicadoRepositorySQLite } from '../../../src/adapters/repositories/comunicado.repository.sqlite';
import { SQLiteExecutorFake } from '../../fakes/sqlite-executor-in-memory.fake';
import { Comunicado } from '../../../src/domain/entities/comunicado.entity';

function criarComunicadoDeTeste(props?: Partial<{
  id: string;
  condominioId: string;
  autorId: string;
  autorNome: string;
  titulo: string;
  conteudo: string;
  fixado: boolean;
}>): Comunicado {
  return new Comunicado({
    id: props?.id ?? 'com-1',
    condominioId: props?.condominioId ?? 'cond-1',
    autorId: props?.autorId ?? 'sindico-1',
    autorNome: props?.autorNome ?? 'Dr. Carlos',
    titulo: props?.titulo ?? 'Aviso',
    conteudo: props?.conteudo ?? 'Conteúdo',
    fixado: props?.fixado ?? false,
  });
}

describe('ComunicadoRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: ComunicadoRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new ComunicadoRepositorySQLite(executor);
  });

  it('deve salvar e buscar um comunicado por id', async () => {
    const comunicado = criarComunicadoDeTeste({ id: 'com-1', titulo: 'Manutenção', fixado: true });

    await repo.salvar(comunicado);

    const encontrado = await repo.buscarPorId('com-1');
    expect(encontrado).not.toBeNull();
    expect(encontrado?.id).toBe('com-1');
    expect(encontrado?.titulo).toBe('Manutenção');
    expect(encontrado?.condominioId).toBe('cond-1');
    expect(encontrado?.autorId).toBe('sindico-1');
    expect(encontrado?.fixado).toBe(true);
  });

  it('deve retornar null quando o comunicado não existe', async () => {
    const encontrado = await repo.buscarPorId('inexistente');
    expect(encontrado).toBeNull();
  });

  it('deve listar comunicados por condomínio', async () => {
    await repo.salvar(criarComunicadoDeTeste({ id: 'com-1', condominioId: 'cond-1' }));
    await repo.salvar(criarComunicadoDeTeste({ id: 'com-2', condominioId: 'cond-2' }));

    const lista = await repo.listarPorCondominio('cond-1');
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('com-1');
  });

  it('deve atualizar um comunicado existente (upsert)', async () => {
    await repo.salvar(criarComunicadoDeTeste({ id: 'com-1', titulo: 'Original' }));
    await repo.salvar(criarComunicadoDeTeste({ id: 'com-1', titulo: 'Atualizado' }));

    const encontrado = await repo.buscarPorId('com-1');
    expect(encontrado?.titulo).toBe('Atualizado');
  });
});
