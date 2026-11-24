/**
 * Testes para FileSystemGateway (FA 2.2)
 *
 * Usa a API nova do `expo-file-system` (SDK 58): `File`, `Directory` e `Paths`.
 * As classes são substituídas por implementações em memória porque o módulo
 * nativo não roda no Jest.
 */
import * as FileSystem from 'expo-file-system';
import { IFileSystemGateway } from '../../../src/domain/interfaces/file-system.gateway.interface';
import { FileSystemGateway } from '../../../src/adapters/gateways/file-system.gateway.real';

jest.mock('expo-file-system', () => {
  const arquivos = new Map<string, string>();
  const diretorios = new Set<string>();

  class File {
    constructor(private readonly caminho: string) {}

    get uri(): string {
      return this.caminho;
    }

    get exists(): boolean {
      return arquivos.has(this.caminho);
    }

    async write(conteudo: string): Promise<void> {
      arquivos.set(this.caminho, conteudo);
    }

    async text(): Promise<string> {
      const conteudo = arquivos.get(this.caminho);
      if (conteudo === undefined) {
        throw new Error('File does not exist');
      }
      return conteudo;
    }

    delete(): void {
      arquivos.delete(this.caminho);
    }
  }

  class Directory {
    constructor(private readonly caminho: string) {}

    get uri(): string {
      return this.caminho;
    }

    get exists(): boolean {
      return diretorios.has(this.caminho);
    }

    create(options?: { intermediates?: boolean; idempotent?: boolean }): void {
      if (diretorios.has(this.caminho) && !options?.idempotent) {
        throw new Error('Directory already exists');
      }
      diretorios.add(this.caminho);
      if (options?.intermediates) {
        const partes = this.caminho.split('/').filter(Boolean);
        for (let i = 1; i <= partes.length; i++) {
          diretorios.add(`${partes.slice(0, i).join('/')}/`);
        }
      }
    }

    delete(): void {
      diretorios.delete(this.caminho);
    }
  }

  return {
    File,
    Directory,
    Paths: {
      document: new Directory('file:///data/user/0/com.sindiflow/files/'),
      cache: new Directory('file:///data/user/0/com.sindiflow/cache/'),
    },
    __arquivos: arquivos,
    __diretorios: diretorios,
    __reset: () => {
      arquivos.clear();
      diretorios.clear();
    },
  };
});

const mockFileSystem = FileSystem as unknown as {
  __arquivos: Map<string, string>;
  __diretorios: Set<string>;
  __reset: () => void;
};

beforeEach(() => {
  mockFileSystem.__reset();
});

describe('FileSystemGateway', () => {
  let gateway: IFileSystemGateway;

  beforeEach(() => {
    gateway = new FileSystemGateway();
  });

  it('salva e lê um arquivo', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-123.jpg';
    const conteudo = 'dados-do-arquivo';

    await gateway.salvarArquivo(uri, conteudo);

    await expect(gateway.lerArquivo(uri)).resolves.toBe(conteudo);
    expect(mockFileSystem.__arquivos.get(uri)).toBe(conteudo);
  });

  it('retorna true quando o arquivo existe', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-456.jpg';
    await gateway.salvarArquivo(uri, 'conteudo-qualquer');

    await expect(gateway.arquivoExiste(uri)).resolves.toBe(true);
  });

  it('retorna false quando o arquivo não existe', async () => {
    await expect(
      gateway.arquivoExiste('file:///Documentos/sindiflow/inexistente.jpg')
    ).resolves.toBe(false);
  });

  it('remove um arquivo e é idempotente quando ele já não existe', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-remover.jpg';
    await gateway.salvarArquivo(uri, 'para-remover');

    await gateway.removerArquivo(uri);
    await expect(gateway.arquivoExiste(uri)).resolves.toBe(false);

    await expect(gateway.removerArquivo(uri)).resolves.toBeUndefined();
  });

  it('cria diretório com intermediários e é idempotente', async () => {
    const uri = 'file:///Documentos/sindiflow/evidencias/';

    await gateway.criarDiretorio(uri);
    await expect(gateway.arquivoExiste(uri)).resolves.toBe(true);

    await expect(gateway.criarDiretorio(uri)).resolves.toBeUndefined();
  });

  it('lança erro ao ler arquivo inexistente', async () => {
    await expect(gateway.lerArquivo('file:///inexistente.jpg')).rejects.toThrow();
  });
});
