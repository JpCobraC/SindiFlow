/**
 * Testes do adapter nativo do Google (Nitro).
 *
 * O SDK nativo não roda no Jest; o módulo é mockado por completo. O contrato
 * testado é o da porta `GoogleSignInGateway`: devolver o `idToken` ou `null`
 * em cancelamento — nunca trocar token por sessão (isso é do Supabase).
 */
import { GoogleSignInGatewayNative } from '../../../src/adapters/gateways/google-signin.gateway.native';

const mockGoogleOneTapSignIn = {
  configure: jest.fn(),
  checkPlayServices: jest.fn(async () => undefined),
  presentExplicitSignIn: jest.fn(),
};

jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: mockGoogleOneTapSignIn,
  isSuccessResponse: (resposta: any) =>
    resposta?.type === 'success' && resposta?.data != null,
  isCancelledResponse: (resposta: any) => resposta?.type === 'cancelled',
}));

const respostaSucesso = {
  type: 'success',
  data: { idToken: 'google-id-token', user: { email: 'teste@exemplo.com' } },
};

describe('GoogleSignInGatewayNative', () => {
  let gateway: GoogleSignInGatewayNative;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new GoogleSignInGatewayNative('web-client-id.apps.googleusercontent.com');
  });

  it('configura o SDK uma única vez com o webClientId', async () => {
    mockGoogleOneTapSignIn.presentExplicitSignIn
      .mockResolvedValueOnce(respostaSucesso)
      .mockResolvedValueOnce(respostaSucesso);

    await gateway.obterIdToken();
    await gateway.obterIdToken();

    expect(mockGoogleOneTapSignIn.configure).toHaveBeenCalledTimes(1);
    expect(mockGoogleOneTapSignIn.configure).toHaveBeenCalledWith({
      webClientId: 'web-client-id.apps.googleusercontent.com',
      iosClientId: undefined,
    });
  });

  it('valida o Google Play Services antes de abrir o seletor', async () => {
    mockGoogleOneTapSignIn.presentExplicitSignIn.mockResolvedValue(respostaSucesso);

    await gateway.obterIdToken();

    expect(mockGoogleOneTapSignIn.checkPlayServices).toHaveBeenCalledTimes(1);
    expect(mockGoogleOneTapSignIn.presentExplicitSignIn).toHaveBeenCalledTimes(1);
  });

  it('devolve o idToken em sucesso', async () => {
    mockGoogleOneTapSignIn.presentExplicitSignIn.mockResolvedValue(respostaSucesso);

    await expect(gateway.obterIdToken()).resolves.toBe('google-id-token');
  });

  it('devolve null quando o usuário cancela', async () => {
    mockGoogleOneTapSignIn.presentExplicitSignIn.mockResolvedValue({
      type: 'cancelled',
      data: null,
    });

    await expect(gateway.obterIdToken()).resolves.toBeNull();
  });

  it('devolve null quando não há credencial salva', async () => {
    mockGoogleOneTapSignIn.presentExplicitSignIn.mockResolvedValue({
      type: 'noSavedCredentialFound',
      data: null,
    });

    await expect(gateway.obterIdToken()).resolves.toBeNull();
  });

  it('propaga erro nativo em vez de tratá-lo como cancelamento', async () => {
    mockGoogleOneTapSignIn.checkPlayServices.mockRejectedValue(
      Object.assign(new Error('Play Services indisponível'), {
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
      })
    );

    await expect(gateway.obterIdToken()).rejects.toThrow('Play Services indisponível');
  });

  it('rejeita configuração vazia em vez de abrir o seletor sem client id', async () => {
    const semClientId = new GoogleSignInGatewayNative('   ');

    await expect(semClientId.obterIdToken()).rejects.toThrow(/webClientId/i);
  });
});
