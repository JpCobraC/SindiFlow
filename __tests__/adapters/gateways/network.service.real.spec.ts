/**
 * Testes para NetworkServiceReal (FA 2.1)
 *
 * Testa a lógica de tri-estado da rede: ONLINE / OFFLINE / INDETERMINADO.
 * Como `expo-network` não roda sob Jest (sem ambiente nativo), mockamos o módulo.
 */
import * as Network from 'expo-network';
import { EstadoRede, INetworkService } from '../../../src/domain/interfaces/network.service.interface';
import { NetworkServiceReal } from '../../../src/adapters/gateways/network.service.real';

jest.mock('expo-network', () => {
  let isInternetReachable: boolean | null = null;
  return {
    NetworkState: {
      NOT_REACHABLE: 'not_reachable',
      REACHABLE_VIA_CELLULAR: 'cellular',
      REACHABLE_VIA_WIFI: 'wifi',
    },
    getNetworkStateAsync: jest.fn(async () => ({
      isInternetReachable,
    })),
    __setIsInternetReachable: (value: boolean | null) => {
      isInternetReachable = value;
    },
  };
});

const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NetworkServiceReal', () => {
  let service: INetworkService;

  beforeEach(() => {
    service = new NetworkServiceReal();
  });

  it('deve retornar OFFLINE quando isInternetReachable é null', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: null });

    const estado = await service.estadoConexao();
    expect(estado).toBe(EstadoRede.OFFLINE);
  });

  it('deve retornar OFFLINE quando isInternetReachable é false', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: false });

    const estado = await service.estadoConexao();
    expect(estado).toBe(EstadoRede.OFFLINE);
  });

  it('deve retornar ONLINE quando isInternetReachable é true', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: true });

    const estado = await service.estadoConexao();
    expect(estado).toBe(EstadoRede.ONLINE);
  });

  it('estaConectado deve retornar true apenas quando ONLINE', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: true });
    expect(await service.estaConectado()).toBe(true);
  });

  it('estaConectado deve retornar false quando OFFLINE', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: false });
    expect(await service.estaConectado()).toBe(false);
  });

  it('estaConectado deve retornar false quando INDETERMINADO', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: null });
    expect(await service.estaConectado()).toBe(false);
  });

  it('deve retornar ONLINE quando isConnected é true e isInternetReachable é null (Android)', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: null,
    });

    const estado = await service.estadoConexao();
    expect(estado).toBe(EstadoRede.ONLINE);
    expect(await service.estaConectado()).toBe(true);
  });

  it('deve chamar expo-network getNetworkStateAsync', async () => {
    mockGetNetworkStateAsync.mockResolvedValue({ isInternetReachable: true });
    await service.estadoConexao();
    expect(mockGetNetworkStateAsync).toHaveBeenCalledTimes(1);
  });
});
