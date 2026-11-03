import { OutboxRepositoryInMemory } from '../../src/adapters/repositories/outbox.repository.inmemory';
import {
  OutboxEvent,
  StatusOutbox,
} from '../../src/domain/entities/outbox-event.entity';

const T0 = new Date('2026-10-13T12:00:00.000Z');

function dados(overrides: Partial<Parameters<OutboxRepositoryInMemory['enfileirar']>[0]> = {}) {
  return {
    tabela: 'vistorias',
    operacao: 'UPDATE' as const,
    // Registro que a escrita afeta, e não o id do evento — RF-SYNC-007.
    idRegistro: 'vist-1',
    payload: { id: 'vist-1' },
    usuarioId: 'user-1',
    deviceId: 'device-1',
    // Fixo, senão o relógio real do teste venceria os instantes de T0 e os
    // eventos nasceriam "no futuro" em relação ao instante da asserção.
    dataCriacao: T0,
    ...overrides,
  };
}

describe('OutboxRepositoryInMemory (Adapters)', () => {
  let repo: OutboxRepositoryInMemory;
  let sequencia: number;

  beforeEach(() => {
    repo = new OutboxRepositoryInMemory();
    // Cada teste recebe ids previsíveis para não depender da ordem de execução.
    sequencia = 0;
    jest.spyOn(repo, 'proximoId').mockImplementation(() => `out-${++sequencia}`);
  });

  describe('enfileirar', () => {
    it('deve derivar a chaveDedup a partir da escrita lógica (RF-SYNC-007)', async () => {
      // Teste de fiação, não de unidade: a entidade tem spec própria. O que se
      // prova aqui é que o repositório REPASSA `idRegistro` até a chave — se um
      // adapter discardsse o campo, a entidade lançaria e este teste acusaria.
      const evento = await repo.enfileirar(
        dados({ tabela: 'ocorrencias', operacao: 'INSERT', idRegistro: 'oc-42' })
      );

      expect(evento.chaveDedup).toBe('ocorrencias:INSERT:oc-42');
    });

    it('deve produzir a mesma chave para dois eventos da mesma escrita lógica', async () => {
      const primeiro = await repo.enfileirar(dados({ id: 'out-1', idRegistro: 'vist-1' }));
      const segundo = await repo.enfileirar(dados({ id: 'out-2', idRegistro: 'vist-1' }));

      expect(segundo.chaveDedup).toBe(primeiro.chaveDedup);
      expect(segundo.id).not.toBe(primeiro.id);
    });

    it('deve produzir chaves diferentes para escritas lógicas diferentes', async () => {
      const a = await repo.enfileirar(dados({ id: 'out-1', idRegistro: 'vist-1' }));
      const b = await repo.enfileirar(dados({ id: 'out-2', idRegistro: 'vist-2' }));

      expect(a.chaveDedup).not.toBe(b.chaveDedup);
    });

    it('deve devolver o evento criado, com id e status PENDENTE', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1' }));

      expect(evento).toBeInstanceOf(OutboxEvent);
      expect(evento.status).toBe(StatusOutbox.PENDENTE);
      expect(evento.tentativas).toBe(0);
    });

    it('deve persistir os campos que o DDL exige: tabela, operacao, autor e dispositivo', async () => {
      await repo.enfileirar(dados({ id: 'out-1', tabela: 'ocorrencias', operacao: 'INSERT' }));

      const [evento] = await repo.obterPendentes();
      expect(evento.tabela).toBe('ocorrencias');
      expect(evento.operacao).toBe('INSERT');
      expect(evento.usuarioId).toBe('user-1');
      expect(evento.deviceId).toBe('device-1');
    });

    it('deve atribuir ids únicos a cada evento', async () => {
      await repo.enfileirar(dados());
      await repo.enfileirar(dados());
      await repo.enfileirar(dados());

      const pendentes = await repo.obterPendentes();
      expect(new Set(pendentes.map((e) => e.id)).size).toBe(3);
    });
  });

  describe('obterPendentes', () => {
    it('deve devolver apenas eventos PENDENTE e com prazo vencido', async () => {
      const imediata = await repo.enfileirar(dados({ id: 'out-1' }));
      const falho = await repo.enfileirar(dados({ id: 'out-2' }));

      await repo.iniciarProcessamento(falho.id);


      falho.registrarFalha('timeout', T0);

      const pendentes = await repo.obterPendentes(new Date(T0.getTime() + 2000));

      expect(pendentes.map((e) => e.id)).toEqual([imediata.id, falho.id]);
    });

    it('NÃO deve devolver evento cujo prazo de retry ainda não venceu', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1' }));
      await repo.iniciarProcessamento(evento.id);

      evento.registrarFalha('timeout', T0);

      // Apenas 500ms depois: o backoff de 1s ainda não venceu.
      expect(await repo.obterPendentes(new Date(T0.getTime() + 500))).toHaveLength(0);
      expect(await repo.obterPendentes(new Date(T0.getTime() + 1000))).toHaveLength(1);
    });

    it('NÃO deve devolver evento em FALHA_MAXIMA (dead-letter)', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1', maxTentativas: 1 }));
      await repo.iniciarProcessamento(evento.id);

      evento.registrarFalha('dead', T0);

      expect(evento.status).toBe(StatusOutbox.FALHA_MAXIMA);
      expect(await repo.obterPendentes(new Date(T0.getTime() + 60_000))).toHaveLength(0);
    });

    it('NÃO deve devolver evento já SINCRONIZADO', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1' }));
      evento.iniciarProcessamento();
      evento.marcarSincronizado(T0);

      expect(await repo.obterPendentes(new Date(T0.getTime() + 60_000))).toHaveLength(0);
    });

    it('deve respeitar o limite de itens por lote', async () => {
      for (let i = 0; i < 5; i++) await repo.enfileirar(dados({ id: `out-${i}` }));

      expect(await repo.obterPendentes(new Date(T0), 2)).toHaveLength(2);
    });

    it('deve ignorar head-of-line: um item em espera não bloqueia os demais', async () => {
      const bloqueado = await repo.enfileirar(dados({ id: 'out-bloqueado' }));
      await repo.iniciarProcessamento(bloqueado.id);
      bloqueado.registrarFalha('timeout', T0);
      await repo.enfileirar(dados({ id: 'out-livre' }));

      // O bloqueado não está pronto, mas o livre é devolvido normalmente.
      // limite=1 garante que o `break` só pode parar depois de considerar os dois:
      // o buggy `slice(0, limite)` devolveria o bloqueado e o teste falharia.
      const pendentes = await repo.obterPendentes(new Date(T0.getTime() + 10), 1);
      expect(pendentes.map((e) => e.id)).toEqual(['out-livre']);
    });
  });

  describe('registrarFalha', () => {
    it('deve incrementar tentativas, gravar o erro e reagendar o prazo', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1' }));
      await repo.iniciarProcessamento(evento.id);

      await repo.registrarFalha('out-1', 'HTTP 503', T0);

      const [atualizado] = await repo.listarTodos();
      expect(atualizado).toBeDefined();
      expect(atualizado.tentativas).toBe(1);
      expect(atualizado.ultimoErro).toBe('HTTP 503');
      expect(atualizado.proximoRetryMs).toBe(1000);
    });

    it('deve ignorar id inexistente sem lançar', async () => {
      await expect(repo.registrarFalha('nao-existe', 'erro', T0)).resolves.toBeUndefined();
    });
  });

  describe('marcarSincronizado retém o registro (§3.3)', () => {
    it('deve marcar SINCRONIZADO e MANTER o evento na fila como evidência de auditoria', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1' }));
      evento.iniciarProcessamento();

      await repo.marcarSincronizado('out-1', T0);

      const todos = await repo.listarTodos();
      expect(todos).toHaveLength(1);
      expect(todos[0].status).toBe(StatusOutbox.SINCRONIZADO);
      expect(todos[0].dataSincronizacao).toEqual(T0);
      expect(await repo.obterPendentes(new Date(T0.getTime() + 60_000))).toHaveLength(0);
    });
  });

  describe('descartarSincronizados (retenção)', () => {
    it('deve apagar apenas o que foi sincronizado antes do instante informado', async () => {
      const antigo = await repo.enfileirar(dados({ id: 'out-antigo' }));
      antigo.iniciarProcessamento();
      antigo.marcarSincronizado(new Date(T0.getTime() - 7 * 24 * 3600 * 1000));

      const recente = await repo.enfileirar(dados({ id: 'out-recente' }));
      recente.iniciarProcessamento();
      recente.marcarSincronizado(T0);

      const pendente = await repo.enfileirar(dados({ id: 'out-pendente' }));

      const removidos = await repo.descartarSincronizados(T0);

      expect(removidos).toBe(1);
      const restantes = await repo.listarTodos();
      expect(restantes.map((e) => e.id).sort()).toEqual(['out-pendente', 'out-recente']);
    });

    it('não deve descartar evento pendente ou em falha', async () => {
      const falho = await repo.enfileirar(dados({ id: 'out-falho', maxTentativas: 1 }));
      await repo.iniciarProcessamento(falho.id);

      falho.registrarFalha('dead', T0);

      expect(await repo.descartarSincronizados(T0)).toBe(0);
      expect(await repo.listarTodos()).toHaveLength(1);
    });
  });

  describe('resetar', () => {
    it('deve devolver um evento em dead-letter à fila ativa', async () => {
      const evento = await repo.enfileirar(dados({ id: 'out-1', maxTentativas: 1 }));
      await repo.iniciarProcessamento(evento.id);

      evento.registrarFalha('dead', T0);
      expect(await repo.obterPendentes(new Date(T0.getTime() + 60_000))).toHaveLength(0);

      await repo.resetar('out-1');

      const pendentes = await repo.obterPendentes(new Date(T0.getTime() + 60_000));
      expect(pendentes).toHaveLength(1);
      expect(pendentes[0].tentativas).toBe(0);
    });
  });
});
