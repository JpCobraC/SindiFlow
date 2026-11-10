/**
 * Testes de mapeamento do OcorrenciaRepositorySQLite contra SQLiteExecutorFake.
 */
import { OcorrenciaRepositorySQLite } from '../../../src/adapters/repositories/ocorrencia.repository.sqlite';
import { SQLiteExecutorFake } from '../../../src/adapters/repositories/sqlite-executor.fake';
import { Ocorrencia } from '../../../src/domain/entities/ocorrencia.entity';
import { GravidadeOcorrencia } from '../../../src/domain/entities/ocorrencia.entity';
import { StatusOcorrencia } from '../../../src/domain/entities/ocorrencia.entity';

function criarOcorrenciaDeTeste(props?: Partial<{
  id: string;
  vistoriaId: string;
  itemId: string;
  titulo: string;
  gravidade: GravidadeOcorrencia;
  fotos: string[];
}>): Ocorrencia {
  return Ocorrencia.criar({
    id: props?.id ?? 'oc-1',
    vistoriaId: props?.vistoriaId ?? 'vist-1',
    itemId: props?.itemId,
    titulo: props?.titulo ?? 'Ocorrência teste',
    gravidade: props?.gravidade ?? GravidadeOcorrencia.MEDIA,
    fotos: props?.fotos ?? [],
  });
}

describe('OcorrenciaRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: OcorrenciaRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new OcorrenciaRepositorySQLite(executor);
  });

  it('deve salvar e buscar uma ocorrência por id', async () => {
    const ocorrencia = criarOcorrenciaDeTeste({
      id: 'oc-1',
      vistoriaId: 'vist-1',
      itemId: 'item-1',
      titulo: 'Infiltração na garagem',
      gravidade: GravidadeOcorrencia.ALTA,
      fotos: ['file:///ev/1.jpg'],
    });

    await repo.salvar(ocorrencia);

    const encontrada = await repo.buscarPorId('oc-1');
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id).toBe('oc-1');
    expect(encontrada?.vistoriaId).toBe('vist-1');
    expect(encontrada?.itemId).toBe('item-1');
    expect(encontrada?.titulo).toBe('Infiltração na garagem');
    expect(encontrada?.gravidade).toBe(GravidadeOcorrencia.ALTA);
    expect(encontrada?.fotos).toHaveLength(1);
  });

  it('deve retornar null quando a ocorrência não existe', async () => {
    const encontrada = await repo.buscarPorId('inexistente');
    expect(encontrada).toBeNull();
  });

  it('deve listar ocorrências por vistoria', async () => {
    const o1 = criarOcorrenciaDeTeste({
      id: 'oc-1',
      vistoriaId: 'vist-A',
      titulo: 'Ocorrencia A1',
    });
    const o2 = criarOcorrenciaDeTeste({
      id: 'oc-2',
      vistoriaId: 'vist-B',
      titulo: 'Ocorrencia B1',
    });
    const o3 = criarOcorrenciaDeTeste({
      id: 'oc-3',
      vistoriaId: 'vist-A',
      titulo: 'Ocorrencia A2',
    });

    await repo.salvar(o1);
    await repo.salvar(o2);
    await repo.salvar(o3);

    const vistA = await repo.listarPorVistoria('vist-A');
    expect(vistA).toHaveLength(2);
    expect(vistA.map((o) => o.id)).toContain('oc-1');
    expect(vistA.map((o) => o.id)).toContain('oc-3');

    const vistB = await repo.listarPorVistoria('vist-B');
    expect(vistB).toHaveLength(1);
    expect(vistB[0]?.id).toBe('oc-2');
  });

  it('deve listar todas as ocorrências', async () => {
    const o1 = criarOcorrenciaDeTeste({ id: 'oc-1', vistoriaId: 'vist-1' });
    const o2 = criarOcorrenciaDeTeste({ id: 'oc-2', vistoriaId: 'vist-1' });

    await repo.salvar(o1);
    await repo.salvar(o2);

    const todas = await repo.listarTodas();
    expect(todas).toHaveLength(2);
  });

  it('deve atualizar uma ocorrência existente (upsert)', async () => {
    const ocorrencia = criarOcorrenciaDeTeste({
      id: 'oc-upd',
      vistoriaId: 'vist-1',
      titulo: 'Título original',
    });

    await repo.salvar(ocorrencia);

    const atualizada = Ocorrencia.criar({
      id: 'oc-upd',
      vistoriaId: 'vist-1',
      itemId: 'item-1',
      titulo: 'Título atualizado',
      gravidade: GravidadeOcorrencia.ALTA,
    });

    await repo.salvar(atualizada);

    const encontrada = await repo.buscarPorId('oc-upd');
    expect(encontrada?.titulo).toBe('Título atualizado');
    expect(encontrada?.gravidade).toBe(GravidadeOcorrencia.ALTA);
  });
});
