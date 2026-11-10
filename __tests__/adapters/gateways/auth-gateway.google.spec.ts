/**
 * Testes para AuthGatewayGoogle (FA 4.4)
 *
 * Mockamos expo-auth-session pois não há ambiente de dispositivo nos testes Jest.
 * Testa o fluxo OAuth do Google com deep linking nativo (sem navegador web).
 */
jest.mock('expo-auth-session', () => {
  return {
    useAuthRequest: jest.fn(() => [
      null,
      { discovery: null, promptAsyncAsync: jest.fn() },
    ]),
  };
});

import { AuthGatewayGoogle } from '../../../src/adapters/gateways/auth-gateway.google';

describe('AuthGatewayGoogle', () => {
  let gateway: AuthGatewayGoogle;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new AuthGatewayGoogle(
      'https://exemplo.supabase.co',
      'anon-key-teste'
    );
  });

  it('deve ser instanciado com URL e anon key do Supabase', () => {
    expect(gateway).toBeDefined();
  });

  it('loginComProvedorSocial deve usar provedor google', async () => {
    // O teste verifica que o gateway aceita 'google' como provedor
    // e tenta iniciar o fluxo OAuth nativo
    await expect(
      gateway.loginComProvedorSocial('google')
    ).resolves.toBeDefined();
  });

  it('deve rejeitar provedor não suportado', async () => {
    await expect(
      gateway.loginComProvedorSocial('facebook' as any)
    ).rejects.toThrow();
  });
});
