import {
  GeolocalizacaoObrigatoriaError,
  ItemCriticoSemObservacaoError,
  VistoriaJaFinalizadaError,
  ItemChecklistDeOutraVistoriaError,
  VistoriaNaoFinalizavelError,
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
    // ⚠️ RF-VIST-001 **NÃO** é implementada aqui, apesar do que este comentário
    // afirmava até 16/10/2026. Não existe guarda de transição: o status vem de
    // `props.status` ou do default, e `Vistoria.criar({ status: FINALIZADA })`
    // constrói a vistoria sem reclamar.
    //
    // Isto é deliberado e correto para a **reidratação** — o adapter SQLite
    // monta a vistoria a partir da linha, e uma vistoria já finalizada tem de
    // voltar finalizada. A regra que falta é estreita: só a *criação* deve
    // recusar status diferente de RASCUNHO, sem colidir com a leitura do banco.
    // Registrada como pendência aberta em `docs/rastreabilidade.md` §7.
    this._status = props.status || StatusVistoria.RASCUNHO;
    // Cópias defensivas: `readonly` num `Date` não protege — `dataCriacao
    // .setFullYear(1999)` reescreveria a data real do laudo — e devolver o array
    // interno no getter permitiria `(v.itens as ItemChecklist[]).push(...)`.
    this.dataCriacao = new Date((props.dataCriacao ?? new Date()).getTime());
    this._dataFinalizacao = props.dataFinalizacao
      ? new Date(props.dataFinalizacao.getTime())
      : undefined;
    this._geolocalizacao = props.geolocalizacao;
    this._itens = props.itens ? [...props.itens] : [];

    // Um item de outra vistoria faria `percentualRespondido()` contar o progresso
    // alheio e `finalizar()` travar itens que não são seus.
    for (const item of this._itens) {
      if (item.vistoriaId !== this.id) {
        throw new ItemChecklistDeOutraVistoriaError(item.id, item.vistoriaId, this.id);
      }
    }

    // RF-VIST-007 na reidratação: o adapter SQLite monta a vistoria a partir da
    // linha, sem passar por `finalizar()`. Sem isto, todo cold start devolveria
    // uma vistoria FINALIZADA cujos itens ainda aceitam edição.
    if (this._status === StatusVistoria.FINALIZADA) {
      for (const item of this._itens) {
        item.bloquearEdicao();
      }
    }
  }

  public get status(): StatusVistoria {
    return this._status;
  }

  public get dataFinalizacao(): Date | undefined {
    return this._dataFinalizacao ? new Date(this._dataFinalizacao.getTime()) : undefined;
  }

  public get geolocalizacao(): Geolocalizacao | undefined {
    return this._geolocalizacao;
  }

  public get itens(): readonly ItemChecklist[] {
    return [...this._itens];
  }

  public percentualRespondido(): number {
    if (this._itens.length === 0) return 0;
    const respondidos = this._itens.filter((item) => item.status !== StatusItemChecklist.PENDENTE).length;
    return (respondidos / this._itens.length) * 100;
  }

  /**
   * @param agora instante da assinatura. Injetado para que o teste possa provar
   *             que a data original não é sobrescrita por uma re-finalização.
   */
  public finalizar(geolocalizacao: Geolocalizacao, agora: Date = new Date()): void {
    // RF-VIST-007: vistoria já assinada é imutável. Antes desta guarda, chamar
    // `finalizar` duas vezes sobrescrevia `_dataFinalizacao` e a geolocalização
    // pericial, destruindo a evidência sem trilha de auditoria.
    if (this._status === StatusVistoria.FINALIZADA) {
      throw new VistoriaJaFinalizadaError(this.id);
    }
    if (this._status === StatusVistoria.CANCELADA) {
      throw new VistoriaNaoFinalizavelError(this.id, this._status);
    }

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
    this._dataFinalizacao = agora;

    // RF-VIST-007: a partir daqui o checklist da vistoria também é imutável.
    for (const item of this._itens) {
      item.bloquearEdicao();
    }
  }

  public static criar(props: VistoriaProps): Vistoria {
    return new Vistoria(props);
  }
}
