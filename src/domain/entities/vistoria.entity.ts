import {
  GeolocalizacaoObrigatoriaError,
  ItemChecklistDeOutraVistoriaError,
  ItemCriticoSemObservacaoError,
  VistoriaJaFinalizadaError,
  VistoriaNaoFinalizavelError,
  VistoriaPercentualIncompletoError,
  VistoriaStatusInvalidoError,
} from '../errors/domain-errors';
import { Geolocalizacao } from '../value-objects/geolocalizacao.vo';
import { ItemChecklist, StatusItemChecklist } from './item-checklist.entity';

export enum StatusVistoria {
  RASCUNHO = 'RASCUNHO',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
  APROVADA = 'APROVADA',
  DEVOLVIDA = 'DEVOLVIDA',
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
  parecerTecnico?: string;
  motivoDevolucao?: string;
  aprovadoPor?: string;
  dataAprovacao?: Date;
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
  private _parecerTecnico?: string;
  private _motivoDevolucao?: string;
  private _aprovadoPor?: string;
  private _dataAprovacao?: Date;

  private constructor(props: VistoriaProps) {
    this.id = props.id;
    this.condominioId = props.condominioId;
    this.inspetorId = props.inspetorId;
    this._status = props.status || StatusVistoria.RASCUNHO;
    this._parecerTecnico = props.parecerTecnico;
    this._motivoDevolucao = props.motivoDevolucao;
    this._aprovadoPor = props.aprovadoPor;
    this._dataAprovacao = props.dataAprovacao ? new Date(props.dataAprovacao.getTime()) : undefined;
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

  public get parecerTecnico(): string | undefined {
    return this._parecerTecnico;
  }

  public get motivoDevolucao(): string | undefined {
    return this._motivoDevolucao;
  }

  public get aprovadoPor(): string | undefined {
    return this._aprovadoPor;
  }

  public get dataAprovacao(): Date | undefined {
    return this._dataAprovacao ? new Date(this._dataAprovacao.getTime()) : undefined;
  }

  /**
   * RF16: O Síndico avalia o laudo pericial finalizado e aprova para visualização pública dos condôminos (RF15).
   */
  public aprovar(parecerTecnico?: string, aprovadorId?: string, agora: Date = new Date()): void {
    if (this._status !== StatusVistoria.FINALIZADA) {
      throw new Error('Apenas vistorias finalizadas pelo inspetor podem ser aprovadas pelo síndico.');
    }
    this._status = StatusVistoria.APROVADA;
    this._parecerTecnico = parecerTecnico;
    this._aprovadoPor = aprovadorId;
    this._dataAprovacao = agora;
  }

  /**
   * RF16: O Síndico devolve o laudo pericial para correções/complementações do inspetor.
   */
  public devolver(motivo: string, responsavelId?: string): void {
    if (this._status !== StatusVistoria.FINALIZADA) {
      throw new Error('Apenas vistorias finalizadas podem ser devolvidas para revisão.');
    }
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('Motivo da devolução é obrigatório.');
    }
    this._status = StatusVistoria.DEVOLVIDA;
    this._motivoDevolucao = motivo.trim();
    for (const item of this._itens) {
      item.desbloquearEdicao();
    }
  }

  public static criar(props: VistoriaProps): Vistoria {
    // RF-VIST-001: uma vistoria só pode iniciar com status RASCUNHO.
    if (props.status !== undefined && props.status !== StatusVistoria.RASCUNHO) {
      throw new VistoriaStatusInvalidoError(props.status);
    }
    return new Vistoria(props);
  }

  /**
   * Reidrata uma vistoria a partir de uma linha do banco de dados.
   *
   * Diferente de `criar()`, não aplica a guarda de RF-VIST-001: uma vistoria
   * já finalizada no banco deve voltar finalizada, sem passar por `finalizar()`.
   * Usada exclusivamente pelo adapter SQLite (Fase 1, passo 2b).
   */
  public static reidratar(props: VistoriaProps): Vistoria {
    return new Vistoria(props);
  }
}
