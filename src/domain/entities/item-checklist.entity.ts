import { ItemChecklistNaoEditavelError, ItemCriticoSemObservacaoError } from '../errors/domain-errors';
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
  /**
   * Vistoria dona já finalizada? Preenchido por `Vistoria` na construção.
   * `ItemChecklist` não sabe o status da vistoria sozinho — é o agregado que
   * impõe RF-VIST-007 aos filhos.
   */
  vistoriaFinalizada?: boolean;
}

export class ItemChecklist {
  readonly id: string;
  readonly vistoriaId: string;
  readonly titulo: string;
  readonly categoria: string;
  private _status: StatusItemChecklist;
  private _observacao?: string;
  private _evidencias: Evidencia[];
  private _vistoriaFinalizada: boolean;

  private constructor(props: ItemChecklistProps) {
    this.id = props.id;
    this.vistoriaId = props.vistoriaId;
    this.titulo = props.titulo;
    this.categoria = props.categoria;
    this._status = props.status || StatusItemChecklist.PENDENTE;
    this._observacao = props.observacao;
    this._evidencias = props.evidencias || [];
    this._vistoriaFinalizada = props.vistoriaFinalizada ?? false;
  }

  public get status(): StatusItemChecklist {
    return this._status;
  }

  public get observacao(): string | undefined {
    return this._observacao;
  }

  public get evidencias(): readonly Evidencia[] {
    return this._evidencias;
  }

  public get vistoriaFinalizada(): boolean {
    return this._vistoriaFinalizada;
  }

  public marcarStatus(novoStatus: StatusItemChecklist, observacao?: string): void {
    this.garantirEditavel();
    if (novoStatus === StatusItemChecklist.CRITICO && (!observacao || observacao.trim().length === 0)) {
      throw new ItemCriticoSemObservacaoError();
    }
    this._status = novoStatus;
    if (observacao !== undefined) {
      this._observacao = observacao.trim();
    }
  }

  public adicionarEvidencia(evidencia: Evidencia): void {
    this.garantirEditavel();
    this._evidencias.push(evidencia);
  }

  /**
   * RF-VIST-007 — a vistoria dona é imutável depois de assinada. Chamado pelo
   * agregado, que é quem conhece o status da vistoria.
   */
  public bloquearEdicao(): void {
    this._vistoriaFinalizada = true;
  }

  private garantirEditavel(): void {
    if (this._vistoriaFinalizada) {
      throw new ItemChecklistNaoEditavelError(this.id);
    }
  }

  public static criar(props: ItemChecklistProps): ItemChecklist {
    return new ItemChecklist(props);
  }
}
