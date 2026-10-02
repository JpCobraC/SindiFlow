import { OcorrenciaAltaSemFotoError } from '../errors/domain-errors';

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
  private _solucao?: string;

  private constructor(props: OcorrenciaProps) {
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
    this.dataCriacao = props.dataCriacao || new Date();
    this._dataResolucao = props.dataResolucao;
    this._solucao = props.solucao;
  }

  public get status(): StatusOcorrencia {
    return this._status;
  }

  public get fotos(): ReadonlyArray<string> {
    return this._fotos;
  }

  public get dataResolucao(): Date | undefined {
    return this._dataResolucao;
  }

  public get solucao(): string | undefined {
    return this._solucao;
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
      default:
        return 168;
    }
  }

  public get dataLimiteSla(): Date {
    return new Date(this.dataCriacao.getTime() + this.slaHoras * 60 * 60 * 1000);
  }

  public estaAtrasada(dataReferencia: Date = new Date()): boolean {
    if (this._status === StatusOcorrencia.RESOLVIDA && this._dataResolucao) {
      return this._dataResolucao.getTime() > this.dataLimiteSla.getTime();
    }
    return dataReferencia.getTime() > this.dataLimiteSla.getTime();
  }

  public resolver(dataResolucao: Date = new Date(), solucao?: string): void {
    this._status = StatusOcorrencia.RESOLVIDA;
    this._dataResolucao = dataResolucao;
    this._solucao = solucao;
  }

  public adicionarFoto(caminhoFoto: string): void {
    this._fotos.push(caminhoFoto);
  }

  public static criar(props: OcorrenciaProps): Ocorrencia {
    return new Ocorrencia(props);
  }
}
