import {
  GravidadeInvalidaError,
  OcorrenciaAltaSemFotoError,
  OcorrenciaDataInvalidaError,
  OcorrenciaJaResolvidaError,
} from '../errors/domain-errors';

export enum GravidadeOcorrencia {
  BAIXA = 'BAIXA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
}

export enum StatusOcorrencia {
  ABERTA = 'ABERTA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  RESOLVIDA = 'RESOLVIDA',
  CANCELADA = 'CANCELADA',
}

export interface OcorrenciaProps {
  id: string;
  vistoriaId: string;
  itemId?: string;
  titulo: string;
  descricao?: string;
  gravidade: GravidadeOcorrencia;
  status?: StatusOcorrencia;
  fotos?: string[];
  dataCriacao?: Date;
  dataResolucao?: Date;
  solucao?: string;
}

export class Ocorrencia {
  readonly id: string;
  readonly vistoriaId: string;
  readonly itemId?: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly gravidade: GravidadeOcorrencia;
  private _status: StatusOcorrencia;
  private _fotos: string[];
  readonly dataCriacao: Date;
  private _dataResolucao?: Date;
  private _dataCancelamento?: Date;
  private _solucao?: string;

  private constructor(props: OcorrenciaProps) {
    // Uma gravidade inválida precisa falhar. Antes, o `default` do switch de
    // `slaHoras` fundia BAIXA com qualquer valor desconhecido, e uma ocorrência
    // sem gravidade recebia o prazo mais longo — o menos urgente.
    if (!Object.values(GravidadeOcorrencia).includes(props.gravidade)) {
      throw new GravidadeInvalidaError(props.gravidade);
    }

    // Seção 3.2: Ocorrência ALTA exige foto obrigatória
    if (props.gravidade === GravidadeOcorrencia.ALTA) {
      if (!props.fotos || props.fotos.length === 0) {
        throw new OcorrenciaAltaSemFotoError();
      }
    }

    this.id = props.id;
    this.vistoriaId = props.vistoriaId;
    this.itemId = props.itemId;
    this.titulo = props.titulo;
    this.descricao = props.descricao;
    this.gravidade = props.gravidade;
    this._status = props.status || StatusOcorrencia.ABERTA;
    this._fotos = props.fotos ? [...props.fotos] : [];
    // Cópia defensiva: `readonly` não protege um `Date` de
    // `dataCriacao.setFullYear(1999)`, que reescreveria o prazo do SLA em disco.
    this.dataCriacao = new Date((props.dataCriacao ?? new Date()).getTime());
    this._dataResolucao = props.dataResolucao;
    this._solucao = props.solucao;
  }

  public get status(): StatusOcorrencia {
    return this._status;
  }

  public get dataResolucao(): Date | undefined {
    return this._dataResolucao ? new Date(this._dataResolucao.getTime()) : undefined;
  }

  /**
   * SLA em horas conforme Seção 3.2:
   * ALTA: 24h
   * MEDIA: 72h
   * BAIXA: 7 dias (168h)
   */
  public get slaHoras(): number {
    switch (this.gravidade) {
      case GravidadeOcorrencia.ALTA:
        return 24;
      case GravidadeOcorrencia.MEDIA:
        return 72;
      case GravidadeOcorrencia.BAIXA:
        return 168;
      default:
        // Inalcançável: o construtor rejeita gravidade fora da enum.
        throw new GravidadeInvalidaError(this.gravidade);
    }
  }

  public get dataLimiteSla(): Date {
    return new Date(this.dataCriacao.getTime() + this.slaHoras * 60 * 60 * 1000);
  }

  public get dataCancelamento(): Date | undefined {
    return this._dataCancelamento ? new Date(this._dataCancelamento.getTime()) : undefined;
  }

  public get solucao(): string | undefined {
    return this._solucao;
  }

  public get fotos(): readonly string[] {
    return [...this._fotos];
  }

  public estaAtrasada(dataReferencia: Date = new Date()): boolean {
    // Cancelada nunca está atrasada: o relógio não para para um ticket
    // encerrado. Sem esta guarda ela ficaria "atrasada" indefinidamente.
    if (this._status === StatusOcorrencia.CANCELADA) {
      return false;
    }
    if (this._status === StatusOcorrencia.RESOLVIDA && this._dataResolucao) {
      return this._dataResolucao.getTime() > this.dataLimiteSla.getTime();
    }
    return dataReferencia.getTime() > this.dataLimiteSla.getTime();
  }

  public resolver(dataResolucao: Date = new Date(), solucao?: string): void {
    this.exigirNaoEncerrada('resolver');
    if (dataResolucao.getTime() < this.dataCriacao.getTime()) {
      throw new OcorrenciaDataInvalidaError();
    }
    this._status = StatusOcorrencia.RESOLVIDA;
    this._dataResolucao = new Date(dataResolucao.getTime());
    this._solucao = solucao;
  }

  public cancelar(dataCancelamento: Date = new Date()): void {
    this.exigirNaoEncerrada('cancelar');
    this._status = StatusOcorrencia.CANCELADA;
    this._dataCancelamento = new Date(dataCancelamento.getTime());
  }

  private exigirNaoEncerrada(operacao: string): void {
    if (
      this._status === StatusOcorrencia.RESOLVIDA ||
      this._status === StatusOcorrencia.CANCELADA
    ) {
      throw new OcorrenciaJaResolvidaError(`${this.id} (${operacao})`);
    }
  }

  public adicionarFoto(caminhoFoto: string): void {
    this.exigirNaoEncerrada('adicionarFoto');
    this._fotos.push(caminhoFoto);
  }

  public static criar(props: OcorrenciaProps): Ocorrencia {
    return new Ocorrencia(props);
  }
}
