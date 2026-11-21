/**
 * SindiFlow — FileSystemGateway
 * Camada: Adapters (Gateways)
 *
 * Implementação real de `IFileSystemGateway` usando a API de classes do
 * `expo-file-system` (SDK 58): `File`, `Directory` e `Paths`.
 *
 * Conformidade com §1.4: fotos são armazenadas por caminho no FileSystem,
 * NUNCA em base64 na SQLite.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 */

import { Directory, File } from 'expo-file-system';
import { IFileSystemGateway } from '../../domain/interfaces/file-system.gateway.interface';

export class FileSystemGateway implements IFileSystemGateway {
  /**
   * Salva conteúdo em um arquivo local.
   * Nunca armazena bytes de imagem no bind do SQLite (§1.4).
   */
  async salvarArquivo(uri: string, content: string): Promise<void> {
    await new File(uri).write(content);
  }

  /**
   * Lê o conteúdo de um arquivo.
   */
  async lerArquivo(uri: string): Promise<string> {
    return new File(uri).text();
  }

  /**
   * Verifica se um arquivo — ou diretório — existe no caminho informado.
   */
  async arquivoExiste(uri: string): Promise<boolean> {
    return new File(uri).exists || new Directory(uri).exists;
  }

  /**
   * Remove um arquivo local. `delete()` nativo não é idempotente; a guarda
   * evita transformar remoção repetida em erro de fluxo.
   */
  async removerArquivo(uri: string): Promise<void> {
    const arquivo = new File(uri);
    if (arquivo.exists) {
      arquivo.delete();
    }
  }

  /**
   * Cria um diretório (incluindo intermediários) de forma idempotente.
   */
  async criarDiretorio(uri: string): Promise<void> {
    new Directory(uri).create({ intermediates: true, idempotent: true });
  }
}
