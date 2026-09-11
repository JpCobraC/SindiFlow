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
