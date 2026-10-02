export enum StatusOutbox {
  PENDENTE = 'PENDENTE',
  PROCESSANDO = 'PROCESSANDO',
  SINCRONIZADO = 'SINCRONIZADO',
  FALHA_MAXIMA = 'FALHA_MAXIMA',
}

export interface OutboxEventProps {
  id: string;
  tipo: string;
  payload: Record<string, any>;
  status?: StatusOutbox;
  tentativas?: number;
  maxTentativas?: number;
  ultimoErro?: string;
  dataCriacao?: Date;
  dataSincronizacao?: Date;
}

export class OutboxEvent {
  readonly id: string;
  readonly tipo: string;
  readonly payload: Record<string, any>;
  private _status: StatusOutbox;
  private _tentativas: number;
  readonly maxTentativas: number;
  private _ultimoErro?: string;
  readonly dataCriacao: Date;
  private _dataSincronizacao?: Date;

  private constructor(props: OutboxEventProps) {
    this.id = props.id;
    this.tipo = props.tipo;
    this.payload = props.payload;
    this._status = props.status || StatusOutbox.PENDENTE;
    this._tentativas = props.tentativas || 0;
    this.maxTentativas = props.maxTentativas || 5;
    this._ultimoErro = props.ultimoErro;
    this.dataCriacao = props.dataCriacao || new Date();
    this._dataSincronizacao = props.dataSincronizacao;
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

  public get dataSincronizacao(): Date | undefined {
    return this._dataSincronizacao;
  }

  /**
   * Cálculo de backoff exponencial conforme Seção 1.3:
   * Tentativa 0: 1000ms (1s)
   * Tentativa 1: 2000ms (2s)
   * Tentativa 2: 4000ms (4s)
   * Tentativa 3: 8000ms (8s)
   * Math.pow(2, tentativas) * 1000ms
   */
  public get proximoRetryMs(): number {
    return Math.pow(2, this._tentativas) * 1000;
  }

  public iniciarProcessamento(): void {
    if (this._status === StatusOutbox.SINCRONIZADO) {
      throw new Error('Evento já sincronizado.');
    }
    this._status = StatusOutbox.PROCESSANDO;
  }

  public registrarFalha(erro: string): void {
    this._tentativas += 1;
    this._ultimoErro = erro;

    if (this._tentativas >= this.maxTentativas) {
      this._status = StatusOutbox.FALHA_MAXIMA;
    } else {
      this._status = StatusOutbox.PENDENTE;
    }
  }

  public marcarSincronizado(dataSync: Date = new Date()): void {
    this._status = StatusOutbox.SINCRONIZADO;
    this._dataSincronizacao = dataSync;
    this._ultimoErro = undefined;
  }

  public static criar(props: OutboxEventProps): OutboxEvent {
    return new OutboxEvent(props);
  }
}
