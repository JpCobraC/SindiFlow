/**
 * Testes do identificador estável de dispositivo.
 */
const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};
const mockRandomUUID = jest.fn(() => 'uuid-123');

jest.mock('expo-secure-store', () => mockSecureStore);
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

import { DeviceIdSecureStore } from '../../../src/adapters/auth/device-id.secure-store';

describe('DeviceIdSecureStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reutiliza o id já persistido', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('dev-existente');
    const provider = new DeviceIdSecureStore();

    await expect(provider.obter()).resolves.toBe('dev-existente');
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('gera e persiste um id quando não existe', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    const provider = new DeviceIdSecureStore();

    await expect(provider.obter()).resolves.toBe('dev-uuid-123');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'sindiflow.device_id',
      'dev-uuid-123'
    );
  });

  it('usa cache em memória depois da primeira leitura', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('dev-existente');
    const provider = new DeviceIdSecureStore();

    await provider.obter();
    await provider.obter();

    expect(mockSecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });
});
