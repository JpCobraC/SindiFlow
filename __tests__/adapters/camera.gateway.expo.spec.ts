const mockGetCameraPermissionsAsync = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: () => mockGetCameraPermissionsAsync(),
  requestCameraPermissionsAsync: () => mockRequestCameraPermissionsAsync(),
  launchCameraAsync: (opts: any) => mockLaunchCameraAsync(opts),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

const mockManipulateAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (uri: string, actions: any[], opts: any) => mockManipulateAsync(uri, actions, opts),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

const mockDigestStringAsync = jest.fn();
jest.mock('expo-crypto', () => ({
  digestStringAsync: (algo: any, data: string) => mockDigestStringAsync(algo, data),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

const mockDirectoryCreate = jest.fn();
const mockFileCopy = jest.fn();
const MOCK_FILE_SIZE = 215000;
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = true;
    size = MOCK_FILE_SIZE;
    constructor(...parts: any[]) {
      this.uri = parts
        .map((p: any) => (typeof p === 'string' ? p : (p && p.uri) || ''))
        .join('/')
        .replace(/([^:/])\/{2,}/g, '$1/');
    }
    async copy(dest: any) {
      mockFileCopy({ from: this.uri, to: dest && dest.uri });
    }
  }
  class Directory {
    uri: string;
    exists = true;
    constructor(...parts: any[]) {
      let u = parts
        .map((p: any) => (typeof p === 'string' ? p : (p && p.uri) || ''))
        .join('/')
        .replace(/([^:/])\/{2,}/g, '$1/');
      if (!u.endsWith('/')) u += '/';
      this.uri = u;
    }
    create(opts: any) {
      mockDirectoryCreate(this.uri, opts);
    }
  }
  const documentDir = new Directory('file:///data/user/0/com.sindiflow/files/');
  return {
    File,
    Directory,
    Paths: { document: documentDir },
  };
});

import { CameraGatewayExpo } from '../../src/adapters/gateways/camera.gateway.expo';

describe('CameraGatewayExpo (Adapter Nativo Expo)', () => {
  let gateway: CameraGatewayExpo;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new CameraGatewayExpo();

    mockManipulateAsync.mockImplementation(async (uri: string, actions: any[]) => ({
      uri: `${uri}_compressed.jpg`,
      width: 1080,
      height: 608,
    }));

    mockDigestStringAsync.mockResolvedValue('sha256_pericial_hash_456');
    mockDirectoryCreate.mockImplementation(() => undefined);
    mockFileCopy.mockImplementation(() => undefined);
  });

  it('deve verificar permissão existente através do ImagePicker', async () => {
    mockGetCameraPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    const temPermissao = await gateway.temPermissao();
    expect(temPermissao).toBe(true);
    expect(mockGetCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve solicitar permissão quando chamada explicitamente', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(false);
    expect(mockRequestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve capturar, comprimir para máx 1080p e salvar em sandbox privado sem ir para a galeria (RNF08 / §1.4)', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
          width: 3840,
          height: 2160,
          fileSize: 4200000,
          fileName: 'evidencia_01.jpg',
        },
      ],
    });

    const resultado = await gateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    // 1. Câmera disparada
    expect(mockLaunchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    // 2. Manipulação de imagem (redimensiona para 1080p e comprime em JPEG)
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
      [{ resize: { width: 1080 } }],
      expect.objectContaining({ format: 'jpeg' })
    );

    // 3. Hash criptográfico SHA-256 de integridade
    expect(mockDigestStringAsync).toHaveBeenCalled();

    // 4. Armazenamento seguro no diretório privado do aplicativo (sem galeria)
    expect(mockDirectoryCreate).toHaveBeenCalledWith(
      'file:///data/user/0/com.sindiflow/files/evidencias/',
      expect.objectContaining({ intermediates: true })
    );
    expect(mockFileCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg_compressed.jpg',
        to: expect.stringContaining('file:///data/user/0/com.sindiflow/files/evidencias/evi_'),
      })
    );

    expect(resultado.status).toBe('sucesso');
    if (resultado.status === 'sucesso') {
      expect(resultado.foto.uri).toContain('files/evidencias/');
      expect(resultado.foto.largura).toBe(1080);
      expect(resultado.foto.tamanhoBytes).toBe(215000);
      expect(resultado.foto.hash).toBe('sha256_pericial_hash_456');
    }
  });

  it('deve redimensionar pela altura quando a imagem é mais alta que larga', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
          width: 1080,
          height: 1920,
          fileSize: 4200000,
          fileName: 'evidencia_02.jpg',
        },
      ],
    });

    const resultado = await gateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
      [{ resize: { height: 1080 } }],
      expect.objectContaining({ format: 'jpeg' })
    );
    expect(resultado.status).toBe('sucesso');
  });

  it('deve manter o asset original quando a manipulação falha', async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error('manipulação indisponível'));
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
          width: 3840,
          height: 2160,
          fileSize: 4200000,
          fileName: 'evidencia_03.jpg',
        },
      ],
    });

    const resultado = await gateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    expect(resultado.status).toBe('sucesso');
    if (resultado.status === 'sucesso') {
      expect(resultado.foto.uri).toContain('files/evidencias/');
    }
  });

  it('deve manter o uri processado quando a cópia para o sandbox falha', async () => {
    mockFileCopy.mockImplementationOnce(() => {
      throw new Error('falha de cópia');
    });
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///data/user/0/com.sindiflow/cache/raw_camera.jpg',
          width: 3840,
          height: 2160,
          fileSize: 4200000,
          fileName: 'evidencia_04.jpg',
        },
      ],
    });

    const resultado = await gateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    expect(resultado.status).toBe('sucesso');
    if (resultado.status === 'sucesso') {
      expect(resultado.foto.uri).toContain('raw_camera.jpg_compressed.jpg');
    }
  });

  it('deve reportar erro quando a câmera lança exceção', async () => {
    mockLaunchCameraAsync.mockRejectedValueOnce(new Error('câmera indisponível'));

    const resultado = await gateway.capturarFoto();

    expect(resultado.status).toBe('erro');
    if (resultado.status === 'erro') {
      expect(resultado.mensagem).toBe('câmera indisponível');
    }
  });

  it('deve retornar status cancelado se o usuário cancelar a câmera (RNF02)', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    const resultado = await gateway.capturarFoto();
    expect(resultado.status).toBe('cancelado');
  });
});
