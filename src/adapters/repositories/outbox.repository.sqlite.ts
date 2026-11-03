import { OutboxEvent, OperacaoOutbox, StatusOutbox } from '../../domain/entities/outbox-event.entity';
import { OutboxNaoProcessavelError } from '../../domain/errors/domain-errors';
import { DadosOutbox, IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { ISQLiteExecutor, SqlParam } from './sqlite-executor.interface';

function iso(date?: Date): string | null {
  return date ? date.toISOString() : null;
}

export type LinhaOutbox = {
  id: string;
  tabela: string;
  operacao: OperacaoOutbox;
  idRegistro: string;
  payload_json: string;
  usuario_id: string;
  device_id: string;
  status: StatusOutbox;
  tentativas: number;
  ultimo_erro: string | null;
  proximo_retry_ms: number;
  data_ultima_tentativa: string | null;
  max_tentativas: number;
  chave_dedup: string;
  data_criacao: string;
  data_sincronizacao: string | null;
};

export class OutboxRepositorySQLite implements IOutboxRepository {
  private sequencia = 0;

  constructor(private readonly executor: ISQLiteExecutor) {}

  private proximoId(): string {
    this.sequencia += 1;
    return `out-${this.sequencia}`;
  }

  private chaveDedup(dados: DadosOutbox): string {
    return `${dados.tabela}:${dados.operacao}:${dados.idRegistro}`;
  }

  async enfileirar(dados: DadosOutbox): Promise<OutboxEvent> {
    const evento = OutboxEvent.criar({
      ...dados,
      id: dados.id ?? this.proximoId(),
    });
    const chave = this.chaveDedup(dados);

    const commonParams: SqlParam[] = [
      evento.tabela,
      evento.operacao,
      JSON.stringify(evento.payload),
      evento.usuarioId,
      evento.deviceId,
      evento.status,
      evento.tentativas,
      evento.ultimoErro ?? null,
      evento.proximoRetryMs,
      iso(evento.dataUltimaTentativa),
      evento.maxTentativas,
      evento.dataCriacao.toISOString(),
      iso(evento.dataSincronizacao),
    ];

    const existente = await this.executor.consultarUm<{ id: string }>(
      'SELECT id FROM outbox_events WHERE chave_dedup = ?',
      [chave]
    );

    if (existente) {
      // Coalescer — último vence (§3.3): atualiza o registro existente.
      await this.executor.executar(
        `UPDATE outbox_events SET
          tabela = ?, operacao = ?, payload_json = ?, usuario_id = ?, device_id = ?,
          status = ?, tentativas = ?, ultimo_erro = ?, proximo_retry_ms = ?,
          data_ultima_tentativa = ?, max_tentativas = ?, data_criacao = ?,
          data_sincronizacao = ?
        WHERE chave_dedup = ?`,
        [...commonParams, chave]
      );
    } else {
      await this.executor.executar(
        `INSERT INTO outbox_events (
          id, tabela, operacao, payload_json, usuario_id, device_id,
          status, tentativas, ultimo_erro, proximo_retry_ms,
          data_ultima_tentativa, max_tentativas, chave_dedup,
          data_criacao, data_sincronizacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [evento.id, ...commonParams.slice(0, 11), chave, ...commonParams.slice(11)]
      );
    }

    return evento;
  }

  async obterPendentes(agora: Date = new Date(), limite: number = 50): Promise<OutboxEvent[]> {
    const linhas = await this.executor.consultar<LinhaOutbox>(
      `SELECT * FROM outbox_events
       WHERE status = 'PENDENTE'
         AND (data_ultima_tentativa IS NULL OR data_ultima_tentativa < ?)
       ORDER BY data_criacao ASC
       LIMIT ?`,
      [agora.toISOString(), limite]
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  async iniciarProcessamento(id: string): Promise<OutboxEvent> {
    await this.executor.executar(
      "UPDATE outbox_events SET status = 'PROCESSANDO' WHERE id = ?",
      [id]
    );

    const linha = await this.executor.consultarUm<LinhaOutbox>(
      'SELECT * FROM outbox_events WHERE id = ?',
      [id]
    );

    if (!linha) {
      throw new OutboxNaoProcessavelError(`evento ${id} não existe na fila.`);
    }

    return this.hidratar(linha);
  }

  async listarTodos(): Promise<OutboxEvent[]> {
    const linhas = await this.executor.consultar<LinhaOutbox>(
      'SELECT * FROM outbox_events'
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  async marcarSincronizado(id: string, dataSync: Date = new Date()): Promise<void> {
    await this.executor.executar(
      "UPDATE outbox_events SET status = 'SINCRONIZADO', data_sincronizacao = ? WHERE id = ?",
      [dataSync.toISOString(), id]
    );
  }

  async registrarFalha(id: string, erro: string, agora: Date = new Date()): Promise<void> {
    const linha = await this.executor.consultarUm<{
      tentativas: number;
      max_tentativas: number;
    }>('SELECT tentativas, max_tentativas FROM outbox_events WHERE id = ?', [id]);

    if (!linha) return;

    const tentativas = linha.tentativas + 1;
    const proximoRetryMs = this.calcularBackoffMs(tentativas);
    const status = tentativas >= linha.max_tentativas ? StatusOutbox.FALHA_MAXIMA : StatusOutbox.PENDENTE;

    await this.executor.executar(
      `UPDATE outbox_events SET
        status = ?, tentativas = ?, ultimo_erro = ?,
        proximo_retry_ms = ?, data_ultima_tentativa = ?
      WHERE id = ?`,
      [status, tentativas, erro, proximoRetryMs, agora.toISOString(), id]
    );
  }

  async registrarFalhaPermanente(id: string, erro: string, agora: Date = new Date()): Promise<void> {
    const linha = await this.executor.consultarUm<{ tentativas: number }>(
      'SELECT tentativas FROM outbox_events WHERE id = ?', [id]
    );

    if (!linha) return;

    await this.executor.executar(
      `UPDATE outbox_events SET
        status = 'FALHA_MAXIMA', tentativas = ?, ultimo_erro = ?,
        data_ultima_tentativa = ?
      WHERE id = ?`,
      [linha.tentativas + 1, erro, agora.toISOString(), id]
    );
  }

  async resetar(id: string): Promise<void> {
    const linha = await this.executor.consultarUm<{ status: string }>(
      'SELECT status FROM outbox_events WHERE id = ?', [id]
    );

    if (!linha || linha.status !== StatusOutbox.FALHA_MAXIMA) {
      throw new OutboxNaoProcessavelError(
        `só um evento em FALHA_MAXIMA pode ser resetado (status atual: ${linha?.status ?? 'inexistente'}).`
      );
    }

    await this.executor.executar(
      `UPDATE outbox_events SET
        status = 'PENDENTE', tentativas = 0, ultimo_erro = NULL,
        proximo_retry_ms = 1000, data_ultima_tentativa = NULL,
        data_sincronizacao = NULL
      WHERE id = ?`,
      [id]
    );
  }

  async descartarSincronizados(anteriorA: Date): Promise<number> {
    const resultado = await this.executor.executar(
      `DELETE FROM outbox_events
       WHERE status = 'SINCRONIZADO' AND data_sincronizacao < ?`,
      [anteriorA.toISOString()]
    );

    return resultado.alteracoes;
  }

  private hidratar(linha: LinhaOutbox): OutboxEvent {
    const partes = linha.chave_dedup.split(':');
    const idRegistro = partes.slice(2).join(':');

    return OutboxEvent.criar({
      id: linha.id,
      tabela: linha.tabela,
      operacao: linha.operacao,
      idRegistro,
      payload: JSON.parse(linha.payload_json),
      usuarioId: linha.usuario_id,
      deviceId: linha.device_id,
      status: linha.status,
      tentativas: linha.tentativas,
      maxTentativas: linha.max_tentativas,
      ultimoErro: linha.ultimo_erro ?? undefined,
      proximoRetryMs: linha.proximo_retry_ms,
      dataUltimaTentativa: linha.data_ultima_tentativa ? new Date(linha.data_ultima_tentativa) : undefined,
      dataCriacao: new Date(linha.data_criacao),
      dataSincronizacao: linha.data_sincronizacao ? new Date(linha.data_sincronizacao) : undefined,
    });
  }

  private calcularBackoffMs(tentativas: number): number {
    const expoente = Math.max(0, tentativas - 1);
    return Math.min(Math.pow(2, expoente) * 1000, 60_000);
  }
}
