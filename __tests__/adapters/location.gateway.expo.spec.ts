const mockGetForegroundPermissionsAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockGetForegroundPermissionsAsync(),
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissionsAsync(),
  getCurrentPositionAsync: (opts: any) => mockGetCurrentPositionAsync(opts),
  Accuracy: {
    High: 4,
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
}));

import { LocationGatewayExpo } from '../../src/adapters/gateways/location.gateway.expo';

describe('LocationGatewayExpo (Adapter Nativo Expo)', () => {
  let gateway: LocationGatewayExpo;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new LocationGatewayExpo();
  });

  it('deve verificar permissão em foreground através de getForegroundPermissionsAsync', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    const temPermissao = await gateway.temPermissao();
    expect(temPermissao).toBe(true);
    expect(mockGetForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve solicitar permissão de foreground via requestForegroundPermissionsAsync', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    const concedida = await gateway.solicitarPermissao();
    expect(concedida).toBe(true);
    expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('deve obter posição atual com alta precisão (RF-VIST-004)', async () => {
    const timestampMs = 1710000000000;
    mockGetCurrentPositionAsync.mockResolvedValueOnce({
      coords: {
        latitude: -23.561684,
        longitude: -46.655981,
        altitude: 800,
        accuracy: 5.2,
        altitudeAccuracy: 2,
        heading: 0,
        speed: 0,
      },
      timestamp: timestampMs,
    });

    const posicao = await gateway.obterPosicaoAtual();

    expect(mockGetCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: 4,
    });

    expect(posicao.latitude).toBe(-23.561684);
    expect(posicao.longitude).toBe(-46.655981);
    expect(posicao.precisao).toBe(5.2);
    expect(posicao.timestamp).toEqual(new Date(timestampMs));
  });

  it('deve lançar erro se a leitura do GPS falhar', async () => {
    mockGetCurrentPositionAsync.mockRejectedValueOnce(
      new Error('Sinal de GPS indisponível no subsolo')
    );

    await expect(gateway.obterPosicaoAtual()).rejects.toThrow(
      'Sinal de GPS indisponível no subsolo'
    );
  });
});
