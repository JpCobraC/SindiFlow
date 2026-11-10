/**
 * SindiFlow — AuthGatewayGoogle
 * Camada: Adapters (Gateways)
 *
 * Implementação de `AuthGateway` usando Sign in with Google via
 * `expo-auth-session` com deep linking nativo (sem navegador web).
 *
 * O Google é um provedor social dentro do Supabase Auth, não um sistema
 * separado. Após o login com Google, o token é trocado por uma sessão
 * Supabase via `client.auth.signInWithIdToken`.
 *
 * Conformidade com §1.1: fluxo OAuth roda nativo via `expo-auth-session`,
 * sem navegador web/PWA.
 * Conformidade com §1.3: criação/atualização de usuário passa pela outbox.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AuthGateway,
  ResultadoAutenticacao,
  SessaoUsuario,
} from '../../domain/interfaces/auth.gateway.interface';

WebBrowser.maybeCompleteAuthSession();

export class AuthGatewayGoogle implements AuthGateway {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey);
  }

  async loginPorEmail(
    email: string,
    senha: string
  ): Promise<ResultadoAutenticacao> {
    // O gateway Google não autentica por email/senha — delega para o gateway Supabase
    throw new Error('Use AuthGatewaySupabase para login por e-mail.');
  }

  async loginComProvedorSocial(
    provedor: 'google'
  ): Promise<ResultadoAutenticacao | null> {
    if (provedor !== 'google') {
      throw new Error(`Provedor não suportado: ${provedor}`);
    }

    try {
      const discovery = await Google.expoAuthSession.discovery(
        'https://accounts.google.com/.well-known/openid-configuration'
      );

      if (!discovery) {
        return null;
      }

      const authRequest = new Google.AuthSession(
        {
          clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
          scopes: ['openid', 'email', 'profile'],
          extraParams: {
            prompt: 'select_account',
          },
        },
        discovery
      );

      const result = await authRequest.promptAsync();

      if (result.type !== 'success') {
        // Usuário cancelou o fluxo OAuth
        return null;
      }

      const { id_token } = result.params;

      if (!id_token) {
        return null;
      }

      // Troca o ID token do Google por uma sessão Supabase
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: 'google',
        token: id_token,
      });

      if (error || !data.session || !data.user) {
        return null;
      }

      return this.mapearSessao(data.session, data.user);
    } catch {
      return null;
    }
  }

  async renovarSessao(refreshToken: string): Promise<SessaoUsuario> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Falha ao renovar sessão.');
    }

    return this.mapearSessao(data.session, data.user);
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async obterSessaoSalva(): Promise<SessaoUsuario | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error || !data.session || !data.user) {
      return null;
    }

    return this.mapearSessao(data.session, data.user);
  }

  async temSessaoValida(): Promise<boolean> {
    const sessao = await this.obterSessaoSalva();
    if (!sessao) return false;

    return sessao.expiraEm.getTime() > Date.now();
  }

  private mapearSessao(
    session: any,
    user: any
  ): ResultadoAutenticacao {
    const expiraEm = session.expires_at
      ? new Date(session.expires_at * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const userMetadata = (user.user_metadata as any) ?? {};
    const email = user.email ?? '';
    const nomePartes = email.split('@');

    const sessao: SessaoUsuario = {
      id: user.id,
      nome: userMetadata.nome || userMetadata.full_name || nomePartes[0] || 'Usuário',
      email,
      role: userMetadata.role || 'CONDOMINO',
      condominioId: userMetadata.condominio_id || 'cond-1',
      unidade: userMetadata.unidade,
      registroProfissional: userMetadata.registroProfissional,
      expiraEm,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };

    return {
      sessao,
      usuarioNovo: false,
    };
  }
}
