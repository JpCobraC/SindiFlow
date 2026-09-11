import {
  GeolocalizacaoObrigatoriaError,
  ItemCriticoSemObservacaoError,
  VistoriaPercentualIncompletoError,
} from '../errors/domain-errors';
import { Geolocalizacao } from '../value-objects/geolocalizacao.vo';
import { ItemChecklist, StatusItemChecklist } from './item-checklist.entity';

export enum StatusVistoria {
  RASCUNHO = 'RASCUNHO',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

export interface VistoriaProps {
  id: string;
  condominioId: string;
  inspetorId: string;
  status?: StatusVistoria;
  dataCriacao?: Date;
  dataFinalizacao?: Date;
  geolocalizacao?: Geolocalizacao;
  itens?: ItemChecklist[];
}

export class Vistoria {
  readonly id: string;
  readonly condominioId: string;
  readonly inspetorId: string;
  private _status: StatusVistoria;
  readonly dataCriacao: Date;
  private _dataFinalizacao?: Date;
  private _geolocalizacao?: Geolocalizacao;
  private _itens: ItemChecklist[];

  private constructor(props: VistoriaProps) {
    this.id = props.id;
    this.condominioId = props.condominioId;
    this.inspetorId = props.inspetorId;
    // RF-VIST-001: Uma vistoria só pode iniciar em status RASCUNHO
    this._status = props.status || StatusVistoria.RASCUNHO;
    this.dataCriacao = props.dataCriacao || new Date();
    this._dataFinalizacao = props.dataFinalizacao;
    this._geolocalizacao = props.geolocalizacao;
    this._itens = props.itens || [];
  }

  public get status(): StatusVistoria {
    return this._status;
  }

  public get dataFinalizacao(): Date | undefined {
    return this._dataFinalizacao;
  }

  public get geolocalizacao(): Geolocalizacao | undefined {
    return this._geolocalizacao;
  }

  public get itens(): ReadonlyArray<ItemChecklist> {
    return this._itens;
  }

  public percentualRespondido(): number {
    if (this._itens.length === 0) return 0;
    const respondidos = this._itens.filter((item) => item.status !== StatusItemChecklist.PENDENTE).length;
    return (respondidos / this._itens.length) * 100;
  }

  public finalizar(geolocalizacao: Geolocalizacao): void {
    // RF-VIST-004: Geolocalização é obrigatória para vistoria ser válida
    if (!geolocalizacao) {
      throw new GeolocalizacaoObrigatoriaError();
    }

    // RF-VIST-002: Só pode finalizar se ≥80% dos itens estiverem marcados
    if (this.percentualRespondido() < 80) {
      throw new VistoriaPercentualIncompletoError();
    }

    // RF-VIST-003: Itens com status CRITICO bloqueiam finalização sem justificativa
    for (const item of this._itens) {
      if (item.status === StatusItemChecklist.CRITICO && (!item.observacao || item.observacao.trim().length === 0)) {
        throw new ItemCriticoSemObservacaoError();
      }
    }

    this._geolocalizacao = geolocalizacao;
    this._status = StatusVistoria.FINALIZADA;
    this._dataFinalizacao = new Date();
  }

  public static criar(props: VistoriaProps): Vistoria {
    return new Vistoria(props);
  }
}
