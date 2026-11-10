/**
 * SindiFlow — Interface de FileSystem
 * Camada: Domain (Interfaces/Ports)
 *
 * Contrato puro de domínio para operações de arquivo. Nenhuma importação
 * de SDK Expo ou bibliotecas externas.
 *
 * Conformidade com §1.4: fotos são armazenadas por caminho no FileSystem,
 * NUNCA em base64 na SQLite.
 */

export interface IFileSystemGateway {
  /**
   * Salva conteúdo em um arquivo local.
   * @param uri caminho completo do arquivo (ex: file:///Documentos/sindiflow/ev-123.jpg)
   * @param content conteúdo a ser gravado (string ou base64 do conteúdo do arquivo)
   * @returns Promise que resolve quando a gravação termina
   */
  salvarArquivo(uri: string, content: string): Promise<void>;

  /**
   * Lê o conteúdo de um arquivo local.
   * @param uri caminho completo do arquivo
   * @returns conteúdo do arquivo como string
   */
  lerArquivo(uri: string): Promise<string>;

  /**
   * Verifica se um arquivo existe no local informado.
   * @param uri caminho completo do arquivo
   * @returns true se o arquivo existe, false caso contrário
   */
  arquivoExiste(uri: string): Promise<boolean>;

  /**
   * Remove um arquivo local.
   * @param uri caminho completo do arquivo
   * @returns Promise que resolve quando a remoção termina
   */
  removerArquivo(uri: string): Promise<void>;

  /**
   * Cria um diretório (incluindo intermediários) se ainda não existir.
   * @param uri caminho completo do diretório
   */
  criarDiretorio(uri: string): Promise<void>;
}
