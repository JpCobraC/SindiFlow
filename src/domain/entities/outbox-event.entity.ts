import { OutboxNaoProcessavelError } from '../errors/domain-errors';

export enum StatusOutbox {
  PENDENTE = 'PENDENTE',
  PROCESSANDO = 'PROCESSANDO',
  SINCRONIZADO = 'SINCRONIZADO',
  FALHA_MAXIMA = 'FALHA_MAXIMA',
}

export type OperacaoOutbox = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Teto do backoff (§1.3). A escala de `sindiflow-obrigacoes.md` §1.3 termina em
 * 16s na 5ª tentativa, e o evento entra em `FALHA_MAXIMA` nessa mesma tentativa —
 * então o teto nunca é alcançado na configuração padrão. Ele existe para que um
 * `maxTentativas` maior (configurável por condomínio, Fase 3) não produza uma
 * espera de anos, que é o modo de falha clássico de um backoff sem teto.
 */
export const TETO_BACKOFF_MS = 60_000;

export const MAX_TENTATIVAS_PADRAO = 5;
export const BACKOFF_INICIAL_MS = 1_000;

export interface OutboxEventProps {
  id: string;
  tabela: string;
  operacao: OperacaoOutbox;
  /**
   * O registro que a escrita afeta — **não** o id do evento.
   *
   * Um mesmo registro gera vários eventos ao longo da vistoria (cada item
   * marcado enfileira o seu), então o `id` do evento não serve como chave de
   * deduplicação. É este campo que, junto com `tabela` e `operacao`, identifica
   * a **escrita lógica**: RF-SYNC-007, "reenvio nunca duplica registro".
   */
  idRegistro: string;
  payload: Record<string, unknown>;
  usuarioId: string;
  deviceId: string;
  status?: StatusOutbox;
  tentativas?: number;
  maxTentativas?: number;
  ultimoErro?: string;
  proximoRetryMs?: number;
  dataCriacao?: Date;
  dataUltimaTentativa?: Date;
  dataSincronizacao?: Date;
}

/**
 * Evento da fila de saída — §1.3 "Toda operação de escrita DEVE passar por fila de outbox".
 *
 * Este é o **modelo único** da fila. Antes existiam três, incompatíveis entre si:
 * esta entidade (morta), o DTO plano `ItemOutbox` (sem `status`, sem prazo de
 * retry) e o DDL de `outbox_events` (com todos esses campos). O DDL ganhou, e
 * esta entidade agora é o que o adapter vai ler e gravar.
 *
 * O relógio é sempre injetado por parâmetro nos métodos que dependem de tempo
 * (`registrarFalha`, `estaProntoParaRetry`, `marcarSincronizado`), com `new Date()`
 * apenas como padrão. Sem isso, prazo de retry e limite de SLA são impossíveis de
 * testar de forma determinística.
 */
export class OutboxEvent {
  readonly id: string;
  readonly tabela: string;
  readonly operacao: OperacaoOutbox;
  /**
   * RF-SYNC-007 — chave de deduplicação, derivada de `tabela:operacao:idRegistro`.
   *
   * É **derivada, nunca recebida**: nenhum chamador pode esquecê-la e nenhum
   * chamador pode mandá-la errada. O DDL exige `chave_dedup TEXT NOT NULL` com
   * índice único, então uma chave ausente não falharia em teste — falharia na
   * primeira inserção em produção (C-11).
   */
  readonly chaveDedup: string;
  readonly usuarioId: string;
  readonly deviceId: string;
  readonly maxTentativas: number;
  readonly dataCriacao: Date;

  private _payload: Record<string, unknown>;
  private _status: StatusOutbox;
  private _tentativas: number;
  private _ultimoErro?: string;
  private _proximoRetryMs: number;
  private _dataUltimaTentativa?: Date;
  private _dataSincronizacao?: Date;

  private constructor(props: OutboxEventProps) {
    if (!props.id?.trim()) throw new OutboxNaoProcessavelError('id vazio.');
    if (!props.tabela?.trim()) throw new OutboxNaoProcessavelError('tabela vazia.');
    // Sem esta guarda a chave viraria "vistorias:INSERT:   " — uma chave válida
    // que colide com a de qualquer outro registro em branco.
    if (!props.idRegistro?.trim()) throw new OutboxNaoProcessavelError('idRegistro vazio.');
    if (!props.usuarioId?.trim()) throw new OutboxNaoProcessavelError('usuarioId vazio.');
    if (!props.deviceId?.trim()) throw new OutboxNaoProcessavelError('deviceId vazio.');

    const maxTentativas = props.maxTentativas ?? MAX_TENTATIVAS_PADRAO;
    if (!Number.isInteger(maxTentativas) || maxTentativas <= 0) {
      throw new OutboxNaoProcessavelError(`maxTentativas inválido: ${props.maxTentativas}.`);
    }

    this.id = props.id;
    this.tabela = props.tabela;
    this.operacao = props.operacao;
    this.chaveDedup = `${props.tabela}:${props.operacao}:${props.idRegistro}`;
    this._payload = { ...props.payload };
    this.usuarioId = props.usuarioId;
    this.deviceId = props.deviceId;
    this.maxTentativas = maxTentativas;
    this._status = props.status ?? StatusOutbox.PENDENTE;
    this._tentativas = props.tentativas ?? 0;
    this._ultimoErro = props.ultimoErro;
    this._proximoRetryMs = props.proximoRetryMs ?? BACKOFF_INICIAL_MS;
    this.dataCriacao = props.dataCriacao ?? new Date();
    this._dataUltimaTentativa = props.dataUltimaTentativa;
    this._dataSincronizacao = props.dataSincronizacao;
  }

  public get payload(): Record<string, unknown> {
    return { ...this._payload };
  }

  public get status(): StatusOutbox {
    return this._status;
  }

  public get tentativas(): number {
    return this._tentativas;
  }

  public get ultimoErro(): string | undefined {
    return this._ultimoErro;
  }

  public get proximoRetryMs(): number {
    return this._proximoRetryMs;
  }

  public get dataUltimaTentativa(): Date | undefined {
    return this._dataUltimaTentativa;
  }

  public get dataSincronizacao(): Date | undefined {
    return this._dataSincronizacao;
  }

  /**
   * Instante a partir do qual uma nova tentativa é permitida.
   *
   * Um evento que **nunca falhou** fica pronto imediatamente: o backoff só existe
   * como castigo por uma falha, e aplicar os 1s iniciais ao primeiro envio atrasaria
   * toda a fila sem motivo.
   */
  public get proximoRetryEm(): Date {
    if (!this._dataUltimaTentativa) return this.dataCriacao;
    return new Date(this._dataUltimaTentativa.getTime() + this._proximoRetryMs);
  }

  /**
   * Backoff exponencial puro, antes do teto.
   *
   * Escala de `sindiflow-obrigacoes.md` §1.3: 1s, 2s, 4s, 8s, 16s. O expoente é a
   * tentativa **já falhada** menos um: após a 1ª falha a espera é 1s (2^0), após a
   * 5ª é 16s (2^4). Usar `2^tentativas` deslocaria a escala em um degrau e o
   * primeiro retry esperaria 2s.
   */
  public static calcularBackoffMs(tentativas: number): number {
    const expoente = Math.max(0, tentativas - 1);
    return Math.min(Math.pow(2, expoente) * BACKOFF_INICIAL_MS, TETO_BACKOFF_MS);
  }

  /**
   * Só um evento `PENDENTE` e com prazo vencido pode ser despachado. Filtrar por
   * status **e** por prazo é o que impede retentativa imediata e inanição de
   * head-of-line na fila.
   */
  public estaProntoParaRetry(agora: Date = new Date()): boolean {
    if (this._status !== StatusOutbox.PENDENTE) return false;
    return agora.getTime() >= this.proximoRetryEm.getTime();
  }

  public iniciarProcessamento(): void {
    if (this._status === StatusOutbox.SINCRONIZADO) {
      throw new OutboxNaoProcessavelError('evento já sincronizado.');
    }
    if (this._status === StatusOutbox.FALHA_MAXIMA) {
      throw new OutboxNaoProcessavelError('evento em FALHA_MAXIMA (dead-letter). Use resetar().');
    }
    if (this._status === StatusOutbox.PROCESSANDO) {
      throw new OutboxNaoProcessavelError('evento já está em processamento.');
    }
    this._status = StatusOutbox.PROCESSANDO;
  }

  /**
   * Registra uma falha e recalcula o próximo prazo.
   *
   * Em `FALHA_MAXIMA` a chamada é **no-op**: o estado é terminal e as tentativas
   * param de crescer. Sem isso o contador ia a 6, 7, 8… indefinidamente.
   */
  public registrarFalha(erro: string, agora: Date = new Date()): void {
    if (this._status === StatusOutbox.FALHA_MAXIMA) {
      // Já é terminal: não conta nova tentativa, mas preserva a causa mais recente.
      // Silenciar um 403 posterior manda quem depura a fila atrás do timeout antigo.
      this._ultimoErro = erro;
      return;
    }
    this.exigirEmProcessamento('registrarFalha');

    this._tentativas += 1;
    this._ultimoErro = erro;
    this._dataUltimaTentativa = agora;
    this._proximoRetryMs = OutboxEvent.calcularBackoffMs(this._tentativas);
    this._status =
      this._tentativas >= this.maxTentativas ? StatusOutbox.FALHA_MAXIMA : StatusOutbox.PENDENTE;
  }

  /**
   * Sucesso. O evento **permanece** na fila: §3.3 exige log de auditoria, e o DDL
   * reserva `status`, `data_sincronizacao` e a tabela `sync_log` justamente para
   * reter essa evidência. Apagar o registro destruiria o histórico.
   */
  public marcarSincronizado(dataSync: Date = new Date()): void {
    if (this._status === StatusOutbox.SINCRONIZADO) {
      throw new OutboxNaoProcessavelError('evento já está sincronizado.');
    }
    if (this._status !== StatusOutbox.PROCESSANDO) {
      throw new OutboxNaoProcessavelError('só um evento em PROCESSANDO pode ser sincronizado.');
    }
    this._status = StatusOutbox.SINCRONIZADO;
    this._dataSincronizacao = dataSync;
    this._ultimoErro = undefined;
  }

  /**
   * Falha permanente (C-05): 4xx, payload inválido, usuário revogado.
   *
   * Entra em dead-letter na hora, sem consumir as tentativas restantes. Um 403 não
   * se resolve em 5 minutos de backoff — retentá-lo só atrasa o aviso de que o
   * usuário foi revogado. `resetar()` devolve o evento à fila depois de corrigido.
   */
  public registrarFalhaPermanente(erro: string, agora: Date = new Date()): void {
    if (this._status === StatusOutbox.FALHA_MAXIMA) {
      this._ultimoErro = erro;
      return;
    }
    this.exigirEmProcessamento('registrarFalhaPermanente');

    this._tentativas += 1;
    this._ultimoErro = erro;
    this._dataUltimaTentativa = agora;
    this._proximoRetryMs = OutboxEvent.calcularBackoffMs(this._tentativas);
    this._status = StatusOutbox.FALHA_MAXIMA;
  }

  /**
   * Devolve um evento em dead-letter ou falho à fila ativa, zerando as tentativas.
   * Sem este método um item que esbarrou em `FALHA_MAXIMA` ficava irrecuperável
   * — lacuna C-01, aberta em 29/09.
   */
  public resetar(): void {
    // Só dead-letter é recuperável. Permitir sobre SINCRONIZADO apagaria a
    // assinatura que §3.3 manda reter; sobre PROCESSANDO, desfaria um despacho em
    // curso; sobre PENDENTE saudável, tornaria o retry grátis e repetível.
    if (this._status !== StatusOutbox.FALHA_MAXIMA) {
      throw new OutboxNaoProcessavelError(
        `só um evento em FALHA_MAXIMA pode ser resetado (status atual: ${this._status}).`
      );
    }

    this._status = StatusOutbox.PENDENTE;
    this._tentativas = 0;
    this._ultimoErro = undefined;
    this._proximoRetryMs = BACKOFF_INICIAL_MS;
    this._dataUltimaTentativa = undefined;
    this._dataSincronizacao = undefined;
  }

  private exigirEmProcessamento(operacao: string): void {
    if (this._status === StatusOutbox.SINCRONIZADO) {
      throw new OutboxNaoProcessavelError('evento já sincronizado.');
    }
    if (this._status !== StatusOutbox.PROCESSANDO) {
      throw new OutboxNaoProcessavelError(
        `${operacao} exige um despacho em PROCESSANDO (status atual: ${this._status}).`
      );
    }
  }

  public static criar(props: OutboxEventProps): OutboxEvent {
    return new OutboxEvent(props);
  }
}
