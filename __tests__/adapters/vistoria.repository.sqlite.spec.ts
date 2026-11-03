import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { Evidencia } from '../../src/domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';
import { VistoriaRepositorySQLite } from '../../src/adapters/repositories/vistoria.repository.sqlite';
import { ISQLiteDatabase } from '../../src/infra/db/sqlite-database';

describe('VistoriaRepositorySQLite (Persistência Offline Local)', () => {
  let mockDb: jest.Mocked<ISQLiteDatabase>;
  let repository: VistoriaRepositorySQLite;

  beforeEach(() => {
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };
    repository = new VistoriaRepositorySQLite(mockDb);
  });

  it('deve persistir uma vistoria completa com geolocalização e fotos de evidência no SQLite', async () => {
    const item = ItemChecklist.criar({
      id: 'item-101',
      vistoriaId: 'vist-001',
      titulo: 'Bombas de Recalque',
      categoria: 'Hidráulica',
      status: StatusItemChecklist.OK,
    });

    const foto = Evidencia.criar({
      id: 'evi-foto-01',
      caminhoArquivoLocal: 'file:///data/user/0/cache/bomba_foto.jpg',
      hash: 'sha256_bomba_hash',
      timestamp: new Date('2026-11-03T10:00:00Z'),
    });
    item.adicionarEvidencia(foto);

    const geo = Geolocalizacao.criar({
      latitude: -23.561684,
      longitude: -46.655981,
      precisao: 4.2,
      timestamp: new Date('2026-11-03T10:05:00Z'),
    });

    const vistoria = Vistoria.criar({
      id: 'vist-001',
      condominioId: 'cond-solar',
      inspetorId: 'insp-carlos',
      itens: [item],
    });
    vistoria.finalizar(geo);

    await repository.salvar(vistoria);

    // 1. Deve salvar vistoria com latitude, longitude e precisão (RF-VIST-004)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
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

    // 2. Deve salvar item de checklist
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO itens_checklist'),
      expect.arrayContaining(['item-101', 'vist-001', 'Bombas de Recalque', 'Hidráulica'])
    );

    // 3. Deve salvar foto de evidência no SQLite com referência de arquivo (sem base64 §1.4)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fotos_evidencia'),
      expect.arrayContaining([
        'evi-foto-01',
        'item-101',
        'file:///data/user/0/cache/bomba_foto.jpg',
      ])
    );
  });

  it('deve reconstituir a entidade Vistoria com GPS e fotos a partir de registros do SQLite', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'vist-001',
      condominio_id: 'cond-solar',
      inspetor_id: 'insp-carlos',
      status: 'FINALIZADA',
      latitude: -23.561684,
      longitude: -46.655981,
      precisao: 4.2,
      data_criacao: '2026-11-03T09:00:00.000Z',
      data_finalizacao: '2026-11-03T10:00:00.000Z',
    });

    mockDb.getAllAsync
      // Itens de checklist
      .mockResolvedValueOnce([
        {
          id: 'item-101',
          vistoria_id: 'vist-001',
          titulo: 'Bombas de Recalque',
          categoria: 'Hidráulica',
          status: 'OK',
          observacao: null,
        },
      ])
      // Fotos de evidência
      .mockResolvedValueOnce([
        {
          id: 'evi-foto-01',
          item_id: 'item-101',
          caminho_arquivo: 'file:///data/user/0/cache/bomba_foto.jpg',
          data_captura: '2026-11-03T10:00:00.000Z',
        },
      ]);

    const vistoria = await repository.buscarPorId('vist-001');

    expect(vistoria).not.toBeNull();
    expect(vistoria!.id).toBe('vist-001');
    expect(vistoria!.status).toBe(StatusVistoria.FINALIZADA);
    expect(vistoria!.geolocalizacao?.latitude).toBe(-23.561684);
    expect(vistoria!.geolocalizacao?.longitude).toBe(-46.655981);
    expect(vistoria!.itens.length).toBe(1);
    expect(vistoria!.itens[0].evidencias.length).toBe(1);
    expect(vistoria!.itens[0].evidencias[0].caminhoArquivoLocal).toBe(
      'file:///data/user/0/cache/bomba_foto.jpg'
    );
  });

  it('deve retornar null se a vistoria não existir no SQLite', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    const vistoria = await repository.buscarPorId('vist-inexistente');
    expect(vistoria).toBeNull();
  });
});
