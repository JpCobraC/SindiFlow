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

import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';
import { GoogleSignInGateway } from '../../domain/interfaces/auth.gateway.interface';

export class GoogleSignInGatewayNative implements GoogleSignInGateway {
  private configurado = false;

  constructor(
    private readonly webClientId: string,
    private readonly iosClientId?: string
  ) {}

  async obterIdToken(): Promise<string | null> {
    this.configurar();

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

  private configurar(): void {
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
