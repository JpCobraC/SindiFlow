import { OcorrenciaRepositorySQLite } from '../../src/adapters/repositories/ocorrencia.repository.sqlite';
import { SQLiteExecutorFake } from '../fakes/sqlite-executor.fake';
import { Ocorrencia, GravidadeOcorrencia, StatusOcorrencia } from '../../src/domain/entities/ocorrencia.entity';

const T0 = new Date('2026-10-16T10:00:00.000Z');

function criarOcorrenciaMock(): Ocorrencia {
  return Ocorrencia.criar({
    id: 'oc-1',
    vistoriaId: 'vist-1',
    itemId: 'item-1',
    titulo: 'Vazamento na tubulação',
    descricao: 'Vazamento no corredor do 5º andar',
    gravidade: GravidadeOcorrencia.ALTA,
    fotos: ['file:///foto1.jpg'],
    dataCriacao: T0,
  });
}

function linhaOcorrencia(parciais?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'oc-1',
    vistoria_id: 'vist-1',
    item_id: 'item-1',
    titulo: 'Vazamento na tubulação',
    descricao: 'Vazamento no corredor do 5º andar',
    gravidade: 'ALTA',
    status: 'ABERTA',
    sla_horas: 24,
    data_limite_sla: new Date(T0.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    data_criacao: T0.toISOString(),
    data_resolucao: null,
    data_cancelamento: null,
    solucao: null,
    updated_at: T0.toISOString(),
    ...parciais,
  };
}

describe('OcorrenciaRepositorySQLite', () => {
  describe('salvar', () => {
    it('insere ocorrência com todos os campos incluindo updated_at', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new OcorrenciaRepositorySQLite(executor);
      const ocorrencia = criarOcorrenciaMock();

      await repo.salvar(ocorrencia);

      expect(executor.confirmadas).toHaveLength(1);
      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain('INSERT INTO ocorrencias');
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(params).toContain('oc-1');
      expect(params).toContain('vist-1');
      expect(params).toContain('ALTA');
      expect(params).toContain(24);
    });

    it('atualiza ocorrência existente (upsert)', async () => {
      const executor = new SQLiteExecutorFake()
        .definirAlteracoes('INSERT INTO ocorrencias', 1);
      const repo = new OcorrenciaRepositorySQLite(executor);
      const ocorrencia = criarOcorrenciaMock();

      await repo.salvar(ocorrencia);

      const sql = executor.confirmadas[0].sql;
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    });
  });

  describe('buscarPorId', () => {
    it('hidrata ocorrência do banco', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaOcorrencia()]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      const ocorrencia = await repo.buscarPorId('oc-1');

      expect(ocorrencia).not.toBeNull();
      expect(ocorrencia!.id).toBe('oc-1');
      expect(ocorrencia!.titulo).toBe('Vazamento na tubulação');
      expect(ocorrencia!.gravidade).toBe(GravidadeOcorrencia.ALTA);
      expect(ocorrencia!.status).toBe(StatusOcorrencia.ABERTA);
      expect(ocorrencia!.dataCriacao).toEqual(T0);
    });

    it('devolve null quando ocorrência não existe', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [null]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      const ocorrencia = await repo.buscarPorId('inexistente');

      expect(ocorrencia).toBeNull();
    });

    it('hidrata data de resolução quando presente', async () => {
      const dataResolucao = new Date(T0.getTime() + 60_000);
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaOcorrencia({
          status: 'RESOLVIDA',
          data_resolucao: dataResolucao.toISOString(),
          solucao: 'Vazamento consertado',
        })]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      const ocorrencia = await repo.buscarPorId('oc-1');

      expect(ocorrencia!.status).toBe(StatusOcorrencia.RESOLVIDA);
      expect(ocorrencia!.dataResolucao).toEqual(dataResolucao);
      expect(ocorrencia!.solucao).toBe('Vazamento consertado');
    });
  });

  describe('listarPorVistoria', () => {
    it('devolve ocorrências de uma vistoria', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE vistoria_id = ?', [
          linhaOcorrencia(),
          linhaOcorrencia({ id: 'oc-2', vistoria_id: 'vist-1', titulo: 'Outra ocorrência' }),
        ]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      const ocorrencias = await repo.listarPorVistoria('vist-1');

      expect(ocorrencias).toHaveLength(2);
      expect(ocorrencias[0].id).toBe('oc-1');
      expect(ocorrencias[1].id).toBe('oc-2');
    });

    it('filtra por vistoria_id no SQL', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE vistoria_id = ?', [linhaOcorrencia()]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      await repo.listarPorVistoria('vist-1');

      const sql = executor.registros.find((r) => r.sql.includes('FROM ocorrencias'))!.sql;
      const params = executor.registros.find((r) => r.sql.includes('FROM ocorrencias'))!.params;
      expect(sql).toContain('vistoria_id = ?');
      expect(params).toContain('vist-1');
    });
  });

  describe('listarTodas', () => {
    it('devolve todas as ocorrências', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM ocorrencias', [linhaOcorrencia(), linhaOcorrencia({ id: 'oc-2' })]);
      const repo = new OcorrenciaRepositorySQLite(executor);

      const todas = await repo.listarTodas();

      expect(todas).toHaveLength(2);
    });
  });
});
