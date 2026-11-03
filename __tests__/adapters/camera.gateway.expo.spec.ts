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

import { CameraGatewayExpo } from '../../src/adapters/gateways/camera.gateway.expo';

describe('CameraGatewayExpo (Adapter Nativo Expo)', () => {
  let gateway: CameraGatewayExpo;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new CameraGatewayExpo();
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

  it('deve capturar foto usando launchCameraAsync com opções de qualidade e resolução (RNF08)', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///data/user/0/com.sindiflow/cache/photo.jpg',
          width: 1920,
          height: 1080,
          fileSize: 320000,
          fileName: 'evidencia_01.jpg',
        },
      ],
    });

    const foto = await gateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    expect(mockLaunchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    expect(foto.uri).toBe('file:///data/user/0/com.sindiflow/cache/photo.jpg');
    expect(foto.largura).toBe(1920);
    expect(foto.altura).toBe(1080);
    expect(foto.tamanhoBytes).toBe(320000);
    expect(foto.hash).toContain('evidencia_01.jpg');
  });

  it('deve lançar erro se a captura for cancelada pelo usuário', async () => {
    mockLaunchCameraAsync.mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    await expect(gateway.capturarFoto()).rejects.toThrow('Captura de foto cancelada pelo usuário');
  });
});
