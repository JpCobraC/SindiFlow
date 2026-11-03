import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';
import { VistoriaRepositorySQLite } from '../../src/adapters/repositories/vistoria.repository.sqlite';
import { ISQLiteExecutor } from '../../src/adapters/repositories/sqlite-executor.interface';

describe('VistoriaRepositorySQLite (Persistência Offline Local)', () => {
  let mockExecutor: jest.Mocked<ISQLiteExecutor>;
  let repository: VistoriaRepositorySQLite;

  beforeEach(() => {
    mockExecutor = {
      executar: jest.fn().mockResolvedValue({ linhasAfetadas: 1 }),
      consultar: jest.fn().mockResolvedValue([]),
      consultarUm: jest.fn().mockResolvedValue(null),
      emTransacao: jest.fn().mockImplementation(async (bloco) => bloco(mockExecutor)),
    };
    repository = new VistoriaRepositorySQLite(mockExecutor);
  });

  it('deve persistir uma vistoria completa com geolocalização no SQLite', async () => {
    const geo = Geolocalizacao.criar({
      latitude: -23.561684,
      longitude: -46.655981,
      precisao: 4.2,
      timestamp: new Date('2026-11-03T10:05:00Z'),
    });

    const item = ItemChecklist.criar({
      id: 'item-001',
      vistoriaId: 'vist-001',
      titulo: 'Bombas',
      categoria: 'Hidráulica',
      status: StatusItemChecklist.OK,
    });

    const vistoria = Vistoria.criar({
      id: 'vist-001',
      condominioId: 'cond-solar',
      inspetorId: 'insp-carlos',
      itens: [item],
    });
    vistoria.finalizar(geo);

    await repository.salvar(vistoria);

    // Deve executar transação e salvar vistoria com latitude, longitude e precisão (RF-VIST-004)
    expect(mockExecutor.emTransacao).toHaveBeenCalled();
    expect(mockExecutor.executar).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO vistorias'),
      expect.arrayContaining([
        'vist-001',
        'cond-solar',
        'insp-carlos',
        StatusVistoria.FINALIZADA,
        -23.561684,
        -46.655981,
        4.2,
      ])
    );
  });

  it('deve reconstituir a entidade Vistoria com GPS a partir de registros do SQLite', async () => {
    mockExecutor.consultarUm.mockResolvedValueOnce({
      id: 'vist-001',
      condominio_id: 'cond-solar',
      inspetor_id: 'insp-carlos',
      status: 'FINALIZADA',
      latitude: -23.561684,
      longitude: -46.655981,
      precisao: 4.2,
      data_criacao: '2026-11-03T09:00:00.000Z',
      data_finalizacao: '2026-11-03T10:00:00.000Z',
      updated_at: '2026-11-03T10:00:00.000Z',
    });

    const vistoria = await repository.buscarPorId('vist-001');

    expect(vistoria).not.toBeNull();
    expect(vistoria!.id).toBe('vist-001');
    expect(vistoria!.status).toBe(StatusVistoria.FINALIZADA);
    expect(vistoria!.geolocalizacao?.latitude).toBe(-23.561684);
    expect(vistoria!.geolocalizacao?.longitude).toBe(-46.655981);
    expect(vistoria!.geolocalizacao?.precisao).toBe(4.2);
  });

  it('deve listar vistorias por condomínio', async () => {
    mockExecutor.consultar.mockResolvedValueOnce([
      {
        id: 'vist-001',
        condominio_id: 'cond-solar',
        inspetor_id: 'insp-carlos',
        status: 'EM_ANDAMENTO',
        latitude: null,
        longitude: null,
        precisao: null,
        data_criacao: '2026-11-03T09:00:00.000Z',
        data_finalizacao: null,
        updated_at: '2026-11-03T09:00:00.000Z',
      },
    ]);

    const lista = await repository.listarPorCondominio('cond-solar');
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('vist-001');
  });

  it('deve retornar null se a vistoria não existir no SQLite', async () => {
    mockExecutor.consultarUm.mockResolvedValueOnce(null);

    const vistoria = await repository.buscarPorId('vist-inexistente');
    expect(vistoria).toBeNull();
  });
});
