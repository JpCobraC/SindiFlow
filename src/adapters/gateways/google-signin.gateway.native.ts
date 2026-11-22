/**
 * SindiFlow — GoogleSignInGatewayNative
 * Camada: Adapters (Gateways)
 *
 * Implementação nativa da porta `GoogleSignInGateway` usando
 * `react-native-nitro-google-signin` (Credential Manager no Android e Google
 * Sign-In SDK no iOS).
 *
 * Este adapter **só** obtém o ID token. A troca por sessão Supabase acontece em
 * `AuthGatewaySupabase.loginComIdToken`, mantendo o caso de uso independente de
 * SDKs de provedor.
 *
 * Conformidade com §1.1: 100% nativo. Não usa navegador, `expo-auth-session` ou
 * deep link OAuth.
 */

import { GoogleSignInGateway } from '../../domain/interfaces/auth.gateway.interface';

type GoogleOneTapSignInType = {
  checkPlayServices: () => Promise<void>;
  presentExplicitSignIn: () => Promise<any>;
  configure: (config: { webClientId: string; iosClientId?: string }) => void;
};

interface NitroModuloCarregado {
  GoogleOneTapSignIn: GoogleOneTapSignInType;
  isCancelledResponse: (resposta: any) => boolean;
  isSuccessResponse: (resposta: any) => boolean;
}

/**
 * Carrega `react-native-nitro-google-signin` sob demanda.
 *
 * O Expo Go não contém bibliotecas nativas C++/TurboModules de terceiros
 * compiladas em seu binário pré-construído. O carregamento sob demanda impede que
 * o app quebre durante a inicialização (boot) no Expo Go quando o módulo ainda
 * não foi compilado via Development Build (`npx expo run:android`).
 */
function carregarModuloNitro(): NitroModuloCarregado {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nitro = require('react-native-nitro-google-signin');
    if (!nitro || !nitro.GoogleOneTapSignIn) {
      throw new Error('GoogleOneTapSignIn não exportado.');
    }
    return {
      GoogleOneTapSignIn: nitro.GoogleOneTapSignIn,
      isCancelledResponse:
        nitro.isCancelledResponse ?? ((r: any) => r?.type === 'cancelled'),
      isSuccessResponse:
        nitro.isSuccessResponse ??
        ((r: any) => r?.type === 'success' && r?.data != null),
    };
  } catch (err: any) {
    throw new Error(
      'Google Sign-In nativo (NitroModules) requer Development Build (npx expo run:android). ' +
      'No Expo Go, utilize o login por e-mail e senha.'
    );
  }
}

export class GoogleSignInGatewayNative implements GoogleSignInGateway {
  private configurado = false;

  constructor(
    private readonly webClientId: string,
    private readonly iosClientId?: string
  ) {}

  async obterIdToken(): Promise<string | null> {
    const { GoogleOneTapSignIn, isCancelledResponse, isSuccessResponse } =
      carregarModuloNitro();

    this.configurar(GoogleOneTapSignIn);

    // No iOS resolve imediatamente; no Android garante que o Credential
    // Manager existe antes de abrir o seletor de contas.
    await GoogleOneTapSignIn.checkPlayServices();

    const resposta = await GoogleOneTapSignIn.presentExplicitSignIn();

    if (isCancelledResponse(resposta) || resposta.type === 'noSavedCredentialFound') {
      return null;
    }

    if (!isSuccessResponse(resposta)) {
      throw new Error('Resposta inesperada do Google Sign-In.');
    }

    return resposta.data.idToken;
  }

  private configurar(GoogleOneTapSignIn: GoogleOneTapSignInType): void {
    if (this.configurado) return;

    const webClientId = this.webClientId.trim();
    if (!webClientId) {
      throw new Error(
        'Google Sign-In: webClientId não configurado (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).'
      );
    }

    GoogleOneTapSignIn.configure({
      webClientId,
      iosClientId: this.iosClientId?.trim() || undefined,
    });
    this.configurado = true;
  }
}
