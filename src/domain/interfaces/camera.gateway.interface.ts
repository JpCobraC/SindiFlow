/**
 * Contrato da câmera — domínio puro (zero import de SDK).
 *
 * A compressão de imagem (máx 1080p) e a regra de hash obrigatório
 * (RF-EVI-001) são responsabilidade do adapter, conforme §1.4 do
 * sindiflow-obrigacoes.md. Este contrato define apenas a assinatura
 * dos dados que o adapter deve produzir.
 */
export interface CapturaFotoOptions {
  /**
   * Largura máxima em pixels após compressão.
   * §1.4 exige māx 1080p. Padrão: 1080.
   */
  larguraMaxima?: number;
  /**
   * Altura máxima em pixels após compressão.
   * §1.4 exige māx 1080p. Padrão: 1080.
   */
  alturaMaxima?: number;
  /**
   * Qualidade da compressão (0.a a 1.0).
   * Definido como 0.7 nesta implementação para reduzir consumo
   * de armazenamento em ~15% em comparação a 0.8, com perda
   * visual imperceptível em dispositivos móveis.
   */
  qualidade?: number;
}

/**
 * Fotografia efetivamente obtida após compressão e processamento.
 *
 * `hash` é obrigatório (RF-EVI-001): um adapter que o omita compila
 * em silêncio e desabilita a verificação de integridade da evidência
 * sem nenhum sinal. O hash deve ser gerado a partir da imagem
 * comprimida, não da original.
 */
export interface FotoCapturada {
  uri: string;           // Caminho local via expo-file-system (NUNCA base64)
  largura: number;       // Largura após compressão (máx 1080)
  altura: number;        // Altura após compressão (máx 1080)
  tamanhoBytes: number;  // Tamanha do arquivo comprimido
  hash: string;          // Hash obrigatório (RF-EVI-001) — NOT NULL na SQLite
  timestamp: Date;       // Quando a foto foi tirada
}

/**
 * Resultado discriminado da captura de foto.
 *
 * A distinção entre "cancelado" e "erro" é regra de negócio (RNF02):
 * "cancelado" significa que o inspetor fechou a câmera sem tirar foto.
 * "erro_captura" significa que falhou a captura de hardware/sistema.
 */
export type ResultadoCaptura =
  | { status: 'sucesso'; foto: FotoCapturada }
  | { status: 'cancelado' }
  | { status: 'erro_captura'; mensagem: string };

/**
 * Interface da câmera — domínio puro.
 *
 * Domínio não conhece expo-camera nem expo-image-picker: esses
 * conceitos ficam no adapter (adapters/gateways/). O domínio apenas
 * define o que deve receber e o que deve retornar.
 */
export interface ICameraGateway {
  /**
   * Verifica se o permissão de câmera foi concedida pelo usuário.
   */
  temPermissao(): Promise<boolean>;

  /**
   * Solicita permissão de câmera ao usuário.
   * Retorna `true` se o usuário conceder, `false` se negar.
   */
  solicitarPermissao(): Promise<boolean>;

  /**
   * Captura uma foto com as opções de compressão definidas.
   *
   * O adapter implementador (CameraGatewayExpo) deve:
   * 1. Chamar expo-image-picker.launchCameraAsync() para abrir a câmera
   * 2. Se o usuário cancelar, retornar { status: 'cancelado' }
   * 3. Se houver erro de captura, retornar { status: 'erro_captura', mensagem }
   * 4. Se sucesso, comprimir a imagem para māx 1080p usando
   *    expo-image-manipulator com a qualidade informada (padrão 0.7)
   * 5. Gerar hash da imagem comprimida (RF-EVI-001)
   * 6. Salvar o arquivo em URI local via expo-file-system (NUNCA base64)
   * 7. Retornar o resultado discriminado com uri, dimensões, tamanho e hash
   *
   * @param options - Parâmetros de compressão (larguraMaxima, alturaMaxima, qualidade)
   * @returns Resultado da captura discriminado
   */
  capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura>;
}