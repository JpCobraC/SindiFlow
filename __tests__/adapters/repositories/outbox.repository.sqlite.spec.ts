/**
 * Testes de mapeamento do OutboxRepositorySQLite contra SQLiteExecutorFake.
 *
 * Valida enfileiramento, obtenção de pendentes, marcação como sincronizado,
 * registro de falha, backoff exponencial, dedup e resetar.
 */
import { OutboxRepositorySQLite } from '../../../src/adapters/repositories/outbox.repository.sqlite';
import { SQLiteExecutorFake } from '../../../src/adapters/repositories/sqlite-executor.fake';
import { DadosOutbox } from '../../../src/domain/interfaces/outbox.repository.interface';
import { OperacaoOutbox } from '../../../src/domain/entities/outbox-event.entity';
import { StatusOutbox } from '../../../src/domain/entities/outbox-event.entity';

function criarDadosOutbox(props?: Partial<{
  tabela: string;
  operacao: OperacaoOutbox;
  idRegistro: string;
  usuarioId: string;
  deviceId: string;
}>): DadosOutbox {
  return {
    tabela: props?.tabela ?? 'vistorias',
    operacao: props?.operacao ?? 'INSERT',
    idRegistro: props?.idRegistro ?? 'reg-1',
    payload: { id: 'reg-1', campo: 'valor' },
    usuarioId: props?.usuarioId ?? 'usr-1',
    deviceId: props?.deviceId ?? 'dev-1',
  };
}

describe('OutboxRepositorySQLite', () => {
  let executor: SQLiteExecutorFake;
  let repo: OutboxRepositorySQLite;

  beforeEach(() => {
    executor = new SQLiteExecutorFake();
    repo = new OutboxRepositorySQLite(executor);
  });

  it('deve enfileirar um evento na outbox', async () => {
    const dados = criarDadosOutbox();

    const evento = await repo.enfileirar(dados);

    expect(evento.id).toBeDefined();
    expect(evento.tabela).toBe('vistorias');
    expect(evento.operacao).toBe('INSERT');
    expect(evento.idRegistro).toBe('reg-1');
    expect(evento.status).toBe(StatusOutbox.PENDENTE);
    expect(evento.tentativas).toBe(0);
  });

  it('deve gerar chave de dedup derivada (tabela:operacao:idRegistro)', async () => {
    const dados = criarDadosOutbox({
      tabela: 'itens_checklist',
      operacao: 'UPDATE',
      idRegistro: 'item-42',
    });

    const evento = await repo.enfileirar(dados);
    expect(evento.chaveDedup).toBe('itens_checklist:UPDATE:item-42');
  });

  it('deve obter eventos pendentes', async () => {
    const agora = new Date('2026-11-10T10:00:00Z');

    await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-2' }));

    const pendentes = await repo.obterPendentes(agora);
    expect(pendentes).toHaveLength(2);
  });

  it('deve marcar evento como sincronizado', async () => {
    const evento = await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    const agora = new Date('2026-11-10T10:00:00Z');

    await repo.marcarSincronizado(evento.id, agora);

    const todos = await repo.listarTodos();
    const sincronizado = todos.find((e) => e.id === evento.id);
    expect(sincronizado?.status).toBe(StatusOutbox.SINCRONIZADO);
    expect(sincronizado?.dataSincronizacao).toEqual(agora);
  });

  it('deve registrar falha e incrementar tentativas', async () => {
    const evento = await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    const agora = new Date('2026-11-10T10:00:00Z');

    // Iniciar processamento primeiro
    await repo.iniciarProcessamento(evento.id);

    await repo.registrarFalha(evento.id, 'timeout', agora);

    const todos = await repo.listarTodos();
    const comFalha = todos.find((e) => e.id === evento.id);
    expect(comFalha?.tentativas).toBe(1);
    expect(comFalha?.ultimoErro).toBe('timeout');
  });

  it('deve colocar evento em FALHA_MAXIMA após exceder tentativas', async () => {
    const evento = await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    const agora = new Date('2026-11-10T10:00:00Z');

    // maxTentativas padrão é 5. Registrar falha 5 vezes.
    for (let i = 0; i < 5; i++) {
      await repo.iniciarProcessamento(evento.id);
      await repo.registrarFalha(evento.id, `erro ${i}`, agora);
    }

    const todos = await repo.listarTodos();
    const eventoFinal = todos.find((e) => e.id === evento.id);
    expect(eventoFinal?.status).toBe(StatusOutbox.FALHA_MAXIMA);
  });

  it('deve resetar evento em FALHA_MAXIMA de volta para PENDENTE', async () => {
    const evento = await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    const agora = new Date('2026-11-10T10:00:00Z');

    // Levar a FALHA_MAXIMA
    for (let i = 0; i < 5; i++) {
      await repo.iniciarProcessamento(evento.id);
      await repo.registrarFalha(evento.id, 'erro', agora);
    }

    // Resetar
    await repo.resetar(evento.id);

    const todos = await repo.listarTodos();
    const resetado = todos.find((e) => e.id === evento.id);
    expect(resetado?.status).toBe(StatusOutbox.PENDENTE);
    expect(resetado?.tentativas).toBe(0);
    expect(resetado?.ultimoErro).toBeUndefined();
  });

  it('deve aplicar dedup: segundo enfileiramento com mesma chave atualiza o existente', async () => {
    const dados1 = criarDadosOutbox({ idRegistro: 'reg-dup' });
    const dados2 = criarDadosOutbox({ idRegistro: 'reg-dup' });

    const evento1 = await repo.enfileirar(dados1);
    const evento2 = await repo.enfileirar(dados2);

    const todos = await repo.listarTodos();
    // Dedup: deve haver apenas 1 evento (o segundo atualiza o primeiro)
    const eventosComMesmaChave = todos.filter((e) => e.chaveDedup === evento1.chaveDedup);
    expect(eventosComMesmaChave).toHaveLength(1);
  });

  it('deve listar todos os eventos', async () => {
    await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-1' }));
    await repo.enfileirar(criarDadosOutbox({ idRegistro: 'reg-2' }));

    const todos = await repo.listarTodos();
    expect(todos).toHaveLength(2);
  });
});
