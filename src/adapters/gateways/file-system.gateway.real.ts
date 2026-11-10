/**
 * SindiFlow — FileSystemGateway
 * Camada: Adapters (Gateways)
 *
 * Implementação real de `IFileSystemGateway` usando `expo-file-system`.
 *
 * Conformidade com §1.4: fotos são armazenadas por caminho no FileSystem,
 * NUNCA em base64 na SQLite.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 */

import * as FileSystem from 'expo-file-system';
import { IFileSystemGateway } from '../../domain/interfaces/file-system.gateway.interface';

export class FileSystemGateway implements IFileSystemGateway {
  /**
   * Salva conteúdo em um arquivo local.
   * Nunca armazena bytes de imagem no bind do SQLite (§1.4).
   */
  async salvarArquivo(uri: string, content: string): Promise<void> {
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  /**
   * Lê o conteúdo de um arquivo local.
   */
  async lerArquivo(uri: string): Promise<string> {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  /**
   * Verifica se um arquivo existe no local informado.
   */
  async arquivoExiste(uri: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists === true;
  }

  /**
   * Remove um arquivo local.
   */
  async removerArquivo(uri: string): Promise<void> {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  /**
   * Cria um diretório (incluindo intermediários) se ainda não existir.
   */
  async criarDiretorio(uri: string): Promise<void> {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}
