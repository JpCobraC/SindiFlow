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

const mockMakeDirectoryAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/user/0/com.sindiflow/files/',
  makeDirectoryAsync: (path: string, opts: any) => mockMakeDirectoryAsync(path, opts),
  copyAsync: (opts: any) => mockCopyAsync(opts),
  getInfoAsync: (path: string) => mockGetInfoAsync(path),
}));

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
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 215000 });
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
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
      'file:///data/user/0/com.sindiflow/files/evidencias/',
      { intermediates: true }
    );
    expect(mockCopyAsync).toHaveBeenCalledWith(
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

  it('deve retornar status cancelado se o usuário cancelar a câmera (RNF02)', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    const resultado = await gateway.capturarFoto();
    expect(resultado.status).toBe('cancelado');
  });
});
