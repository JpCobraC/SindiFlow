/**
 * Contrato da câmera — domínio puro (zero import de SDK).
 *
 * A compressão de imagem (máx 1080p) e a regra de hash obrigatório
 * (RF-EVI-001) são responsabilidade do adapter, conforme §1.4 do
 * sindiflow-obrigacoes.md. Este contrato define apenas a assinatura
 * dos dados que o adapter deve produzir.
 */
export interface CapturaFotoOptions {
  larguraMaxima?: number;
  alturaMaxima?: number;
  qualidade?: number;
}

export interface FotoCapturada {
  uri: string;
  largura: number;
  altura: number;
  tamanhoBytes: number;
  hash: string;
  timestamp: Date;
}

export type ResultadoCaptura =
  | { status: 'sucesso'; foto: FotoCapturada }
  | { status: 'cancelado' }
  | { status: 'erro'; mensagem: string }
  | { status: 'erro_captura'; mensagem: string };

export interface ICameraGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura>;
}
