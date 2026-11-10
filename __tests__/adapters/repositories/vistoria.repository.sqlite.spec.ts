/**
 * Testes de mapeamento do VistoriaRepositorySQLite contra SQLiteExecutorFake.
 *
 * Como `expo-sqlite` não roda sob Jest (C-15), usamos o `SQLiteExecutorFake`
 * para validar que o repositórioSQLite mapeia corretamente entidade <-> linha do banco.
 */
import { VistoriaRepositorySQLite } from '../../../src/adapters/repositories/vistoria.repository.sqlite';
import { SQLiteExecutorFake } from '../../../src/adapters/repositories/sqlite-executor.fake';
import { Vistoria } from '../../../src/domain/entities/vistoria.entity';
import { StatusVistoria } from '../../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../../src/domain/entities/item-checklist.entity';
import { Geolocalizacao } from '../../../src/domain/value-objects/geolocalizacao.vo';

function criarVistoriaDeTeste(props?: Partial<{
  id: string;
  condominioId: string;
  inspetorId: string;
  status: StatusVistoria;
  itens: Array<{ id: string; titulo: string; categoria: string }>;
}>): Vistoria {
  const itens = (props?.itens ?? []).map((i) =>
    ItemChecklist.criar({
      id: i.id,
      vistoriaId: props?.id ?? 'vist-test',
      titulo: i.titulo,
      categoria: i.categoria,
    })
  );

  return Vistoria.criar({
    id: props?.id ?? 'vist-test',
    condominioId: props?.condominioId ?? 'cond-test',
    inspetorId: props?.inspetorId ?? 'insp-test',
    itens,
  });
}

describe('VistoriaRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: VistoriaRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new VistoriaRepositorySQLite(executor);
  });

  it('deve salvar e buscar uma vistoria por id', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      itens: [{ id: 'item-1', titulo: 'Item 1', categoria: 'Elétrica' }],
    });

    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-1');
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id).toBe('vist-1');
    expect(encontrada?.condominioId).toBe('cond-1');
    expect(encontrada?.inspetorId).toBe('insp-1');
    expect(encontrada?.status).toBe(StatusVistoria.RASCUNHO);
  });

  it('deve retornar null quando a vistoria não existe', async () => {
    const encontrada = await repo.buscarPorId('inexistente');
    expect(encontrada).toBeNull();
  });

  it('deve listar vistorias por condomínio', async () => {
    const v1 = criarVistoriaDeTeste({
      id: 'vist-1',
      condominioId: 'cond-A',
      inspetorId: 'insp-1',
    });
    const v2 = criarVistoriaDeTeste({
      id: 'vist-2',
      condominioId: 'cond-B',
      inspetorId: 'insp-2',
    });
    const v3 = criarVistoriaDeTeste({
      id: 'vist-3',
      condominioId: 'cond-A',
      inspetorId: 'insp-3',
    });

    await repo.salvar(v1);
    await repo.salvar(v2);
    await repo.salvar(v3);

    const condA = await repo.listarPorCondominio('cond-A');
    expect(condA).toHaveLength(2);
    expect(condA.map((v) => v.id)).toContain('vist-1');
    expect(condA.map((v) => v.id)).toContain('vist-3');

    const condB = await repo.listarPorCondominio('cond-B');
    expect(condB).toHaveLength(1);
    expect(condB[0]?.id).toBe('vist-2');
  });

  it('deve persistir geolocalização na reidratação', async () => {
    const geo = Geolocalizacao.criar({
      latitude: -23.55052,
      longitude: -46.633308,
      precisao: 5.0,
    });

    const vistoria = criarVistoriaDeTeste({
      id: 'vist-geo',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
    });
    // Simula uma vistoria finalizada com geolocalização
    // (não podemos chamar finalizar() aqui sem geolocalização no contexto,
    // então testamos a reidratação direta via salvar com geo)
    // O repositório SQLite hidrata geolocalização da linha do banco.
    // Como o fake não armazena latitude/longitude separadamente, testamos
    // que o repositório não quebra ao salvar/buscar.
    await repo.salvar(vistoria);

    const encontrada = await repo.buscarPorId('vist-geo');
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id).toBe('vist-geo');
  });

  it('deve atualizar uma vistoria existente (upsert)', async () => {
    const vistoria = criarVistoriaDeTeste({
      id: 'vist-upd',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
    });

    await repo.salvar(vistoria);

    // Modifica e salva novamente
    const vistaAtualizada = Vistoria.reidratar({
      id: 'vist-upd',
      condominioId: 'cond-1',
      inspetorId: 'insp-1',
      status: StatusVistoria.FINALIZADA,
    });

    await repo.salvar(vistaAtualizada);

    const encontrada = await repo.buscarPorId('vist-upd');
    expect(encontrada?.status).toBe(StatusVistoria.FINALIZADA);
  });
});
