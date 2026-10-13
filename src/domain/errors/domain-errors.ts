export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class GeolocalizacaoInvalidaError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'GeolocalizacaoInvalidaError';
  }
}

export class ItemCriticoSemObservacaoError extends DomainError {
  constructor() {
    super('Item com status CRITICO exige justificativa/observação (RF-VIST-003)');
    this.name = 'ItemCriticoSemObservacaoError';
  }
}

export class VistoriaPercentualIncompletoError extends DomainError {
  constructor() {
    super('Vistoria só pode ser finalizada se 80% ou mais dos itens estiverem respondidos (RF-VIST-002)');
    this.name = 'VistoriaPercentualIncompletoError';
  }
}

export class GeolocalizacaoObrigatoriaError extends DomainError {
  constructor() {
    super('Geolocalização é obrigatória para finalizar a vistoria (RF-VIST-004)');
    this.name = 'GeolocalizacaoObrigatoriaError';
  }
}

export class OcorrenciaAltaSemFotoError extends DomainError {
  constructor() {
    super('Ocorrência de gravidade ALTA exige obrigatoriamente pelo menos uma foto de evidência (Seção 3.2)');
    this.name = 'OcorrenciaAltaSemFotoError';
  }
}

export class OcorrenciaNaoEncontradaError extends DomainError {
  constructor(id: string) {
    super(`Ocorrência com id ${id} não foi encontrada.`);
    this.name = 'OcorrenciaNaoEncontradaError';
  }
}

export class ConexaoIndisponivelError extends DomainError {
  constructor() {
    super('Operação de sincronização bloqueada: sem conexão com a internet detectada.');
    this.name = 'ConexaoIndisponivelError';
  }
}

export class ItemChecklistNaoEncontradoError extends DomainError {
  constructor(id: string) {
    super(`Item do checklist com id ${id} não foi encontrado.`);
    this.name = 'ItemChecklistNaoEncontradoError';
  }
}

export class PermissaoNegadaError extends DomainError {
  constructor(recurso: string) {
    super(`Permissão para acesso a ${recurso} foi negada pelo usuário (RNF02).`);
    this.name = 'PermissaoNegadaError';
  }
}

export class OutboxNaoProcessavelError extends DomainError {
  constructor(motivo: string) {
    super(`Evento de outbox não pode ser processado: ${motivo}`);
    this.name = 'OutboxNaoProcessavelError';
  }
}


/**
 * Falha tipada de sincronização remota — resolve C-05, aberto em 29/09.
 *
 * A distinção entre transitório e permanente é o que permite respeitar §1.3 sem
 * retentativa inútil: 5xx e timeout são transitórios e seguem o backoff; 4xx
 * significa que o payload está errado ou o usuário foi revogado, e retententar
 * só atrasa o alerta.
 */
export class ErroSincronizacao extends DomainError {
  constructor(
    mensagem: string,
    readonly transitorio: boolean,
    readonly statusCode?: number
  ) {
    super(mensagem);
    this.name = 'ErroSincronizacao';
  }
}

/**
 * Uma vistoria já finalizada não aceita nova finalização.
 *
 * Sem esta guarda, `finalizar()` re-executava em cima de um laudo assinado e
 * sobrescrevia `_dataFinalizacao` e a geolocalização pericial, destruindo a
 * evidência sem trilha de auditoria.
 */
export class VistoriaJaFinalizadaError extends DomainError {
  constructor(id: string) {
    super(`Vistoria ${id} já foi finalizada e não pode ser finalizada novamente (RF-VIST-007).`);
    this.name = 'VistoriaJaFinalizadaError';
  }
}

/**
 * Item de checklist de vistoria já finalizada é imutável (RF-VIST-007).
 *
 * A regra vivia apenas na tela (`index.tsx`), que é contornável por qualquer
 * outro chamador. Invariante de agregado pertence à entidade.
 */
export class ItemChecklistNaoEditavelError extends DomainError {
  constructor(id: string) {
    super(`Item ${id} pertence a vistoria já finalizada e não pode ser editado (RF-VIST-007).`);
    this.name = 'ItemChecklistNaoEditavelError';
  }
}

/**
 * Vistoria em estado terminal que não pode ser assinada.
 *
 * `CANCELADA` era lido do DDL (`status TEXT CHECK(status IN (...,'CANCELADA'))`) e
 * passava direto por `finalizar()`, produzindo um laudo assinado sobre uma vistoria
 * que a administracao já havia encerrado.
 */
export class VistoriaNaoFinalizavelError extends DomainError {
  constructor(id: string, status: string) {
    super(`Vistoria ${id} está em status ${status} e não pode ser finalizada.`);
    this.name = 'VistoriaNaoFinalizavelError';
  }
}

/**
 * Item de checklist pertencente a outra vistoria.
 *
 * Sem esta validação, `percentualRespondido()` somava o progresso alheio e
 * `finalizar()` bloqueava a edição de itens que não eram seus.
 */
export class ItemChecklistDeOutraVistoriaError extends DomainError {
  constructor(itemId: string, vistoriaIdDoItem: string, vistoriaIdEsperada: string) {
    super(
      `Item ${itemId} pertence à vistoria ${vistoriaIdDoItem} e não pode compor a vistoria ${vistoriaIdEsperada}.`
    );
    this.name = 'ItemChecklistDeOutraVistoriaError';
  }
}

/** Gravidade fora da enum de §3.2. */
export class GravidadeInvalidaError extends DomainError {
  constructor(gravidade: unknown) {
    super(
      `Gravidade "${String(gravidade)}" não é válida. Use ALTA, MEDIA ou BAIXA (Seção 3.2).`
    );
    this.name = 'GravidadeInvalidaError';
  }
}

/**
 * Ocorrência já resolvida ou cancelada não muda de estado terminal.
 * Sem isto, uma segunda chamada a `resolver()` apagava o instante e a solução
 * originais do técnico.
 */
export class OcorrenciaJaResolvidaError extends DomainError {
  constructor(id: string) {
    super(`Ocorrência ${id} já foi encerrada e não aceita nova resolução (${'§3.2'}).`);
    this.name = 'OcorrenciaJaResolvidaError';
  }
}

/** Resolução com data anterior à criação — impossível e distorce o SLA. */
export class OcorrenciaDataInvalidaError extends DomainError {
  constructor() {
    super('Data de resolução não pode ser anterior à data de criação da ocorrência.');
    this.name = 'OcorrenciaDataInvalidaError';
  }
}

/**
 * Checklist vazio ou com ids duplicados.
 *
 * Uma vistoria sem itens tem `percentualRespondido() === 0` e fica
 * permanentemente inapto a finalizar (RF-VIST-002), sem nenhum diagnóstico:
 * dead-end silencioso no meio da inspeção.
 */
export class ChecklistVazioError extends DomainError {
  constructor(detalhe: string) {
    super(`Checklist inválido para a vistoria ${detalhe}: exige ao menos um item e ids únicos.`);
    this.name = 'ChecklistVazioError';
  }
}
