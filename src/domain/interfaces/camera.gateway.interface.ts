export interface CapturaFotoOptions {
  qualidade?: number;
  larguraMaxima?: number;
  alturaMaxima?: number;
}

export interface FotoCapturada {
  uri: string;
  largura?: number;
  altura?: number;
  tamanhoBytes?: number;
  hash?: string;
}

export interface ICameraGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  capturarFoto(options?: CapturaFotoOptions): Promise<FotoCapturada>;
}
