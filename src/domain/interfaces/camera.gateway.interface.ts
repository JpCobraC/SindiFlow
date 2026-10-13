export interface CapturaFotoOptions {
  qualidade?: number;
  larguraMaxima?: number;
  alturaMaxima?: number;
}

/**
 * Fotografia efetivamente obtida.
 *
 * `hash` é obrigatório (RF-EVI-001): um adapter que o omita compila em silêncio e
 * desabilita a verificação de integridade da evidência sem nenhum sinal.
 */
export interface FotoCapturada {
  uri: string;
  largura: number;
  altura: number;
  tamanhoBytes: number;
  hash: string;
  timestamp: Date;
}

/**
 * Cancelar é o caminho **mais comum** de uma tela de câmera: `launchCameraAsync`
 * devolve `{ canceled: true, assets: null }`. Com `Promise<FotoCapturada>` o
 * adapter teria de fabricar um `uri` ou lançar, e o RNF02 — *"permissão negada
 * bloqueia a ação com explicação, sem crash"* — não teria como distinguir
 * cancelamento de erro.
 */
export type ResultadoCaptura =
  | { status: 'sucesso'; foto: FotoCapturada }
  | { status: 'cancelado' }
  | { status: 'erro'; mensagem: string };

export interface ICameraGateway {
  temPermissao(): Promise<boolean>;
  solicitarPermissao(): Promise<boolean>;
  /**
   * `larguraMaxima`/`alturaMaxima` não existem como opção do `expo-image-picker`;
   * quem as aplica é o `expo-image-manipulator`. Fica no contrato porque a
   * compressão de §1.4 é regra de negócio, e o adapter é quem a executa.
   */
  capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura>;
}
