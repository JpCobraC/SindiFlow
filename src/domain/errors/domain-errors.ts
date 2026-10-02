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

