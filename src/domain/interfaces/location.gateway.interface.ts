export interface LocalizacaoDispositivo {
  latitude: number;
  longitude: number;
  precisao?: number;
  timestamp?: Date;
}

export interface ILocationGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  obterPosicaoAtual(): Promise<LocalizacaoDispositivo>;
}
