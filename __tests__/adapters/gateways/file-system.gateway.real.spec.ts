/**
 * Testes para FileSystemGateway (FA 2.2)
 *
 * Testa operações de arquivo: salvar, ler, verificar existência, remover,
 * criar diretório. Conformidade com §1.4: nunca base64 na SQLite.
 * Mockamos `expo-file-system` pois não roda em ambiente de teste Jest.
 */
jest.mock('expo-file-system', () => {
  const arquivos: Map<string, string> = new Map();
  const diretorios: Set<string> = new Set();
  return {
    documentDirectory: 'file:///data/user/0/com.sindiflow/files/',
    WritingStyle: { Base64: 'base64' },
    EncodingType: { UTF8: 'utf8' },
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      arquivos.set(uri, content);
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
      const content = arquivos.get(uri);
      if (content === undefined) {
        const erro: any = new Error('File does not exist');
        erro.code = 'E_NOENT';
        throw erro;
      }
      return content;
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      arquivos.delete(uri);
    }),
    getInfoAsync: jest.fn(async (uri: string) => {
      const existe = arquivos.has(uri) || diretorios.has(uri);
      return { exists: existe, isDirectory: diretorios.has(uri) };
    }),
    makeDirectoryAsync: jest.fn(async (uri: string, { intermediates }: any) => {
      diretorios.add(uri);
      if (intermediates) {
        // Criar diretórios pais implicitamente
        const partes = uri.split('/').filter(Boolean);
        for (let i = 1; i <= partes.length; i++) {
          diretorios.add(partes.slice(0, i).join('/'));
        }
      }
    }),
    __arquivos: arquivos,
    __diretorios: diretorios,
    __reset: () => {
      arquivos.clear();
      diretorios.clear();
    },
  };
});

import * as FileSystem from 'expo-file-system';
import { IFileSystemGateway } from '../../../src/domain/interfaces/file-system.gateway.interface';
import { FileSystemGateway } from '../../../src/adapters/gateways/file-system.gateway.real';

const mockWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.Mock;
const mockDeleteAsync = FileSystem.deleteAsync as jest.Mock;
const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const mockMakeDirectoryAsync = FileSystem.makeDirectoryAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (FileSystem as any).__reset();
});

describe('FileSystemGateway', () => {
  let gateway: IFileSystemGateway;

  beforeEach(() => {
    gateway = new FileSystemGateway();
  });

  it('deve salvar e ler um arquivo', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-123.jpg';
    const conteudo = 'dados-do-arquivo';

    await gateway.salvarArquivo(uri, conteudo);
    const lido = await gateway.lerArquivo(uri);

    expect(lido).toBe(conteudo);
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(uri, conteudo);
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(uri, expect.anything());
  });

  it('deve retornar true quando o arquivo existe', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-456.jpg';
    await gateway.salvarArquivo(uri, 'conteudo-qualquer');

    const existe = await gateway.arquivoExiste(uri);
    expect(existe).toBe(true);
    expect(mockGetInfoAsync).toHaveBeenCalledWith(uri, expect.anything());
  });

  it('deve retornar false quando o arquivo não existe', async () => {
    const uri = 'file:///Documentos/sindiflow/inexistente.jpg';
    const existe = await gateway.arquivoExiste(uri);
    expect(existe).toBe(false);
  });

  it('deve remover um arquivo', async () => {
    const uri = 'file:///Documentos/sindiflow/ev-remover.jpg';
    await gateway.salvarArquivo(uri, 'para-remover');

    await gateway.removerArquivo(uri);

    const existe = await gateway.arquivoExiste(uri);
    expect(existe).toBe(false);
    expect(mockDeleteAsync).toHaveBeenCalledWith(uri);
  });

  it('deve criar um diretório', async () => {
    const uri = 'file:///Documentos/sindiflow/evidencias/';
    await gateway.criarDiretorio(uri);

    const existe = await gateway.arquivoExiste(uri);
    expect(existe).toBe(true);
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(uri, { intermediates: true });
  });

  it('deve lançar erro ao ler arquivo inexistente', async () => {
    await expect(gateway.lerArquivo('file:///inexistente.jpg')).rejects.toThrow();
  });
});
