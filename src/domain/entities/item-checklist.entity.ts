import { ItemCriticoSemObservacaoError } from '../errors/domain-errors';
import { Evidencia } from '../value-objects/evidencia.vo';

export enum StatusItemChecklist {
  PENDENTE = 'PENDENTE',
  OK = 'OK',
  AVISO = 'AVISO',
  CRITICO = 'CRITICO',
}

export interface ItemChecklistProps {
  id: string;
  vistoriaId: string;
  titulo: string;
  categoria: string;
  status?: StatusItemChecklist;
  observacao?: string;
  evidencias?: Evidencia[];
}

export class ItemChecklist {
  readonly id: string;
  readonly vistoriaId: string;
  readonly titulo: string;
  readonly categoria: string;
  private _status: StatusItemChecklist;
  private _observacao?: string;
  private _evidencias: Evidencia[];

  private constructor(props: ItemChecklistProps) {
    this.id = props.id;
    this.vistoriaId = props.vistoriaId;
    this.titulo = props.titulo;
    this.categoria = props.categoria;
    this._status = props.status || StatusItemChecklist.PENDENTE;
    this._observacao = props.observacao;
    this._evidencias = props.evidencias || [];
  }

  public get status(): StatusItemChecklist {
    return this._status;
  }

  public get observacao(): string | undefined {
    return this._observacao;
  }

  public get evidencias(): ReadonlyArray<Evidencia> {
    return this._evidencias;
  }

  public marcarStatus(novoStatus: StatusItemChecklist, observacao?: string): void {
    if (novoStatus === StatusItemChecklist.CRITICO && (!observacao || observacao.trim().length === 0)) {
      throw new ItemCriticoSemObservacaoError();
    }
    this._status = novoStatus;
    if (observacao !== undefined) {
      this._observacao = observacao.trim();
    }
  }

  public adicionarEvidencia(evidencia: Evidencia): void {
    this._evidencias.push(evidencia);
  }

  public static criar(props: ItemChecklistProps): ItemChecklist {
    return new ItemChecklist(props);
  }
}
