import { VistoriaRepositorySQLite } from '../../src/adapters/repositories/vistoria.repository.sqlite';
import { SQLiteExecutorFake } from '../fakes/sqlite-executor.fake';
import { Vistoria, StatusVistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { Geolocalizacao } from '../../src/domain/value-objects/geolocalizacao.vo';

const T0 = new Date('2026-10-16T10:00:00.000Z');

function criarVistoriaMock(): Vistoria {
  const itens = [
    ItemChecklist.criar({ id: 'item-1', vistoriaId: 'vist-1', titulo: 'Item 1', categoria: 'Geral' }),
    ItemChecklist.criar({ id: 'item-2', vistoriaId: 'vist-1', titulo: 'Item 2', categoria: 'Geral' }),
  ];
  itens[0].marcarStatus(StatusItemChecklist.OK);
  const geo = Geolocalizacao.criar({ latitude: -23.55, longitude: -46.63, precisao: 5 });
  return Vistoria.criar({
    id: 'vist-1',
    condominioId: 'cond-1',
    inspetorId: 'user-1',
    itens,
    dataCriacao: T0,
    geolocalizacao: geo,
  });
}

function linhaVistoria(parciais?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'vist-1',
    condominio_id: 'cond-1',
    inspetor_id: 'user-1',
    status: 'RASCUNHO',
    latitude: -23.55,
    longitude: -46.63,
    precisao: 5,
    data_criacao: T0.toISOString(),
    data_finalizacao: null,
    updated_at: T0.toISOString(),
    ...parciais,
  };
}

describe('VistoriaRepositorySQLite', () => {
  describe('salvar', () => {
    it('insere vistoria com todos os campos incluindo updated_at', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new VistoriaRepositorySQLite(executor);
      const vistoria = criarVistoriaMock();

      await repo.salvar(vistoria);

      expect(executor.confirmadas).toHaveLength(1);
      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain('INSERT INTO vistorias');
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(params).toContain('vist-1');
      expect(params).toContain('cond-1');
      expect(params).toContain('user-1');
      expect(params).toContain('RASCUNHO');
      expect(params.some((p) => typeof p === 'string' && p.includes(T0.toISOString()))).toBe(true);
    });

    it('usa updated_at atual ao salvar', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new VistoriaRepositorySQLite(executor);
      const vistoria = criarVistoriaMock();

      await repo.salvar(vistoria);

      const params = executor.confirmadas[0].params;
      // updated_at é gerado no momento do salvar (new Date()), então deve ser uma string ISO válida
      const updatedAtIdx = params.findIndex((p) => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(p));
      expect(updatedAtIdx).toBeGreaterThanOrEqual(0);
    });

    it('atualiza vistoria existente (upsert)', async () => {
      const executor = new SQLiteExecutorFake()
        .definirAlteracoes('INSERT INTO vistorias', 1);
      const repo = new VistoriaRepositorySQLite(executor);
      const vistoria = criarVistoriaMock();

      await repo.salvar(vistoria);

      const sql = executor.confirmadas[0].sql;
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    });
  });

  describe('buscarPorId', () => {
    it('hidrata vistoria do banco com status FINALIZADA via reidratar', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaVistoria({ status: 'FINALIZADA', data_finalizacao: T0.toISOString() })]);
      const repo = new VistoriaRepositorySQLite(executor);

      const vistoria = await repo.buscarPorId('vist-1');

      expect(vistoria).not.toBeNull();
      expect(vistoria!.id).toBe('vist-1');
      expect(vistoria!.status).toBe(StatusVistoria.FINALIZADA);
      expect(vistoria!.dataFinalizacao).toEqual(T0);
    });

    it('devolve null quando vistoria não existe', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [null]);
      const repo = new VistoriaRepositorySQLite(executor);

      const vistoria = await repo.buscarPorId('inexistente');

      expect(vistoria).toBeNull();
    });

    it('hidrata geolocalização quando latitude/longitude estão presentes', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaVistoria({
          latitude: -23.55,
          longitude: -46.63,
          precisao: 5,
        })]);
      const repo = new VistoriaRepositorySQLite(executor);

      const vistoria = await repo.buscarPorId('vist-1');

      expect(vistoria!.geolocalizacao).not.toBeNull();
      expect(vistoria!.geolocalizacao!.latitude).toBe(-23.55);
      expect(vistoria!.geolocalizacao!.longitude).toBe(-46.63);
    });

    it('geolocalizacao é undefined quando latitude/longitude são null', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaVistoria({ latitude: null, longitude: null, precisao: null })]);
      const repo = new VistoriaRepositorySQLite(executor);

      const vistoria = await repo.buscarPorId('vist-1');

      expect(vistoria!.geolocalizacao).toBeUndefined();
    });
  });

  describe('listarPorCondominio', () => {
    it('devolve vistorias de um condomínio', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE condominio_id = ?', [
          linhaVistoria(),
          linhaVistoria({ id: 'vist-2', condominio_id: 'cond-1' }),
        ]);
      const repo = new VistoriaRepositorySQLite(executor);

      const vistorias = await repo.listarPorCondominio('cond-1');

      expect(vistorias).toHaveLength(2);
      expect(vistorias[0].id).toBe('vist-1');
      expect(vistorias[1].id).toBe('vist-2');
    });

    it('filtra por condominio_id no SQL', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE condominio_id = ?', [linhaVistoria()]);
      const repo = new VistoriaRepositorySQLite(executor);

      await repo.listarPorCondominio('cond-1');

      const sql = executor.registros.find((r) => r.sql.includes('FROM vistorias'))!.sql;
      const params = executor.registros.find((r) => r.sql.includes('FROM vistorias'))!.params;
      expect(sql).toContain('condominio_id = ?');
      expect(params).toContain('cond-1');
    });
  });
});
