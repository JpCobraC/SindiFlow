import { OutboxRepositorySQLite } from '../../src/adapters/repositories/outbox.repository.sqlite';
import { SQLiteExecutorFake } from '../fakes/sqlite-executor.fake';
import { OperacaoOutbox, StatusOutbox } from '../../src/domain/entities/outbox-event.entity';
import { OutboxNaoProcessavelError } from '../../src/domain/errors/domain-errors';
import { DadosOutbox } from '../../src/domain/interfaces/outbox.repository.interface';

const T0 = new Date('2026-10-16T10:00:00.000Z');

function dadosOutbox(parciais?: Partial<DadosOutbox>): DadosOutbox {
  return {
    tabela: 'vistorias',
    operacao: 'INSERT' as OperacaoOutbox,
    idRegistro: 'vist-1',
    payload: { foo: 'bar' },
    usuarioId: 'user-1',
    deviceId: 'device-1',
    ...parciais,
  };
}

function linhaOutbox(parciais?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'out-1',
    tabela: 'vistorias',
    operacao: 'INSERT',
    idRegistro: 'vist-1',
    payload_json: '{}',
    usuario_id: 'u',
    device_id: 'd',
    status: 'PENDENTE',
    tentativas: 0,
    ultimo_erro: null,
    proximo_retry_ms: 1000,
    data_ultima_tentativa: null,
    max_tentativas: 5,
    chave_dedup: 'vistorias:INSERT:vist-1',
    data_criacao: T0.toISOString(),
    data_sincronizacao: null,
    ...parciais,
  };
}

describe('OutboxRepositorySQLite', () => {
  describe('enfileirar', () => {
    it('insere novo evento com chaveDedup derivada (RF-SYNC-007)', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new OutboxRepositorySQLite(executor);

      const evento = await repo.enfileirar(dadosOutbox());

      expect(evento.chaveDedup).toBe('vistorias:INSERT:vist-1');
      expect(evento.status).toBe(StatusOutbox.PENDENTE);
      expect(executor.confirmadas).toHaveLength(1);
      expect(executor.confirmadas[0].sql).toContain('INSERT INTO outbox_events');
      expect(executor.confirmadas[0].params).toContain('vistorias:INSERT:vist-1');
    });

    it('gera id quando dados.id não é informado', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new OutboxRepositorySQLite(executor);

      const evento = await repo.enfileirar(dadosOutbox());

      expect(evento.id).toBeDefined();
      expect(typeof evento.id).toBe('string');
      expect(evento.id.length).toBeGreaterThan(0);
    });

    it('coalescer: atualiza evento existente quando chave_dedup já existe (C-16, último vence §3.3)', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE chave_dedup', [{ id: 'out-existente' }])
        .definirAlteracoes('UPDATE outbox_events', 1);
      const repo = new OutboxRepositorySQLite(executor);

      const evento = await repo.enfileirar(dadosOutbox({ payload: { novo: 'dado' } }));

      expect(evento.chaveDedup).toBe('vistorias:INSERT:vist-1');
      const sqls = executor.confirmadas.map((e) => e.sql);
      expect(sqls.some((s) => s.includes('INSERT INTO outbox_events'))).toBe(false);
      expect(sqls.some((s) => s.includes('UPDATE outbox_events'))).toBe(true);
    });

    it('coalescer: quando não existe, faz INSERT (não UPDATE)', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE chave_dedup', [])
        .definirAlteracoes('INSERT INTO outbox_events', 1);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.enfileirar(dadosOutbox());

      const sqls = executor.confirmadas.map((e) => e.sql);
      expect(sqls.some((s) => s.includes('INSERT INTO outbox_events'))).toBe(true);
      expect(sqls.some((s) => s.includes('UPDATE outbox_events'))).toBe(false);
    });

    it('serializa payload como JSON', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new OutboxRepositorySQLite(executor);

      await repo.enfileirar(dadosOutbox({ payload: { chave: 123, ativo: true } }));

      const params = executor.confirmadas[0].params;
      const payloadJson = params.find((p) => typeof p === 'string' && p.includes('chave'));
      expect(payloadJson).toBe('{"chave":123,"ativo":true}');
    });
  });

  describe('obterPendentes', () => {
    it('devolve eventos hidratados a partir das linhas programadas', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM outbox_events', [linhaOutbox()]);
      const repo = new OutboxRepositorySQLite(executor);

      const pendentes = await repo.obterPendentes(T0);

      expect(pendentes).toHaveLength(1);
      expect(pendentes[0].id).toBe('out-1');
      expect(pendentes[0].status).toBe(StatusOutbox.PENDENTE);
      expect(pendentes[0].chaveDedup).toBe('vistorias:INSERT:vist-1');
    });

    it('consulta com filtro de status PENDENTE e limite', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM outbox_events', [linhaOutbox()]);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.obterPendentes(T0, 5);

      const sql = executor.registros.find((r) => r.sql.includes('FROM outbox_events'))!.sql;
      expect(sql).toContain("status = 'PENDENTE'");
      expect(sql).toContain('LIMIT ?');
    });

    it('hidrata corretamente a chave_dedup do banco', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM outbox_events', [
          linhaOutbox({
            tabela: 'ocorrencias',
            operacao: 'UPDATE',
            chave_dedup: 'ocorrencias:UPDATE:oc-42',
          }),
        ]);
      const repo = new OutboxRepositorySQLite(executor);

      const pendentes = await repo.obterPendentes(T0);

      expect(pendentes[0].chaveDedup).toBe('ocorrencias:UPDATE:oc-42');
      expect(pendentes[0].tabela).toBe('ocorrencias');
      expect(pendentes[0].operacao).toBe('UPDATE');
    });
  });

  describe('iniciarProcessamento', () => {
    it('transiciona PENDENTE → PROCESSANDO e devolve o evento', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [linhaOutbox({ status: 'PROCESSANDO' })]);
      const repo = new OutboxRepositorySQLite(executor);

      const evento = await repo.iniciarProcessamento('out-1');

      expect(evento.status).toBe(StatusOutbox.PROCESSANDO);
      const sqls = executor.confirmadas.map((e) => e.sql);
      expect(sqls.some((s) => s.includes("status = 'PROCESSANDO'"))).toBe(true);
      expect(sqls.some((s) => s.includes("status = ?"))).toBe(false);
    });

    it('lança OutboxNaoProcessavelError quando o evento não existe', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('WHERE id = ?', [null]);
      const repo = new OutboxRepositorySQLite(executor);

      await expect(repo.iniciarProcessamento('inexistente')).rejects.toThrow(
        OutboxNaoProcessavelError
      );
    });
  });

  describe('listarTodos', () => {
    it('devolve todos os eventos da fila', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM outbox_events', [
          linhaOutbox(),
          linhaOutbox({
            id: 'out-2',
            tabela: 'ocorrencias',
            operacao: 'INSERT',
            chave_dedup: 'ocorrencias:INSERT:oc-1',
            status: 'SINCRONIZADO',
            data_sincronizacao: T0.toISOString(),
          }),
        ]);
      const repo = new OutboxRepositorySQLite(executor);

      const todos = await repo.listarTodos();

      expect(todos).toHaveLength(2);
    });
  });

  describe('marcarSincronizado', () => {
    it('marca o evento como SINCRONIZADO com a data de sincronização', async () => {
      const executor = new SQLiteExecutorFake();
      const repo = new OutboxRepositorySQLite(executor);

      await repo.marcarSincronizado('out-1', T0);

      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain("status = 'SINCRONIZADO'");
      expect(sql).toContain('data_sincronizacao = ?');
      expect(params).toContain(T0.toISOString());
    });
  });

  describe('registrarFalha', () => {
    it('incrementa tentativas, recalcula backoff e mantém PENDENTE se abaixo do teto', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT tentativas, max_tentativas FROM', [
          { tentativas: 0, max_tentativas: 5 },
        ]);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.registrarFalha('out-1', 'timeout', T0);

      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain('tentativas = ?');
      expect(sql).toContain('status = ?');
      expect(params).toContain(StatusOutbox.PENDENTE);
      expect(params).toContain('timeout');
    });

    it('marca FALHA_MAXIMA quando tentativas atingem o teto', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT tentativas, max_tentativas FROM', [
          { tentativas: 4, max_tentativas: 5 },
        ]);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.registrarFalha('out-1', 'erro permanente', T0);

      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain('status = ?');
      expect(params).toContain(StatusOutbox.FALHA_MAXIMA);
    });
  });

  describe('registrarFalhaPermanente', () => {
    it('marca FALHA_MAXIMA imediatamente sem consumir tentativas restantes', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT tentativas FROM', [{ tentativas: 0 }]);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.registrarFalhaPermanente('out-1', '403 revogado', T0);

      const sql = executor.confirmadas[0].sql;
      const params = executor.confirmadas[0].params;
      expect(sql).toContain("status = 'FALHA_MAXIMA'");
      expect(params).toContain('403 revogado');
    });
  });

  describe('resetar', () => {
    it('devolve FALHA_MAXIMA à PENDENTE zerando tentativas', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT status', [{ status: 'FALHA_MAXIMA' }]);
      const repo = new OutboxRepositorySQLite(executor);

      await repo.resetar('out-1');

      const sql = executor.confirmadas[0].sql;
      expect(sql).toContain("status = 'PENDENTE'");
      expect(sql).toContain('tentativas = 0');
    });

    it('lança se o evento não está em FALHA_MAXIMA', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT status', [{ status: 'PENDENTE' }]);
      const repo = new OutboxRepositorySQLite(executor);

      await expect(repo.resetar('out-1')).rejects.toThrow(OutboxNaoProcessavelError);
    });

    it('lança se o evento não existe', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('SELECT status', [null]);
      const repo = new OutboxRepositorySQLite(executor);

      await expect(repo.resetar('out-1')).rejects.toThrow(OutboxNaoProcessavelError);
    });
  });

  describe('descartarSincronizados', () => {
    it('remove sincronizados antes da data e devolve a contagem', async () => {
      const executor = new SQLiteExecutorFake()
        .definirAlteracoes('DELETE FROM outbox_events', 3);
      const repo = new OutboxRepositorySQLite(executor);

      const removidos = await repo.descartarSincronizados(T0);

      expect(removidos).toBe(3);
      const sql = executor.confirmadas[0].sql;
      expect(sql).toContain("status = 'SINCRONIZADO'");
      expect(sql).toContain('data_sincronizacao < ?');
    });

    it('devolve zero quando nada foi sincronizado', async () => {
      const executor = new SQLiteExecutorFake()
        .definirAlteracoes('DELETE FROM outbox_events', 0);
      const repo = new OutboxRepositorySQLite(executor);

      const removidos = await repo.descartarSincronizados(T0);

      expect(removidos).toBe(0);
    });
  });
});
