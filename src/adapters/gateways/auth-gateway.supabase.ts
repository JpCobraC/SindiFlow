/**
 * SindiFlow — AuthGatewaySupabase
 * Camada: Adapters (Gateways)
 *
 * Implementação de `AuthGateway` usando Supabase Auth.
 *
 * Conformidade com §1.3: toda operação de escrita (criação/atualização de
 * usuário após login) passa pela fila de outbox — gerenciada pelo
 * `SincronizarOutboxUseCase` via `AutenticarUsuarioUseCase`.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 * Conformidade com §2: fica em `adapters/`, depende apenas de `domain/`.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AuthGateway,
  ResultadoAutenticacao,
  SessaoUsuario,
} from '../../domain/interfaces/auth.gateway.interface';

export class AuthGatewaySupabase implements AuthGateway {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey);
  }

  async loginPorEmail(
    email: string,
    senha: string
  ): Promise<ResultadoAutenticacao> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Falha na autenticação por e-mail.');
    }

    return this.mapearSessao(data.session, data.user);
  }

  async loginComProvedorSocial(
    provedor: 'google'
  ): Promise<ResultadoAutenticacao | null> {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: provedor,
      options: {
        redirectTo: `${process.env.EXPO_PUBLIC_SCHEME ?? 'sindiflow'}://callback`,
      },
    });

    if (error || !data.session || !data.user) {
      // Usuário cancelou o fluxo OAuth ou erro de provedor
      return null;
    }

    return this.mapearSessao(data.session, data.user);
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

    const sessao: SessaoUsuario = {
      id: user.id,
      nome: (user.user_metadata as any)?.nome || user.email?.split('@')[0] || 'Usuário',
      email: user.email,
      role: (user.user_metadata as any)?.role || 'CONDOMINO',
      condominioId: (user.user_metadata as any)?.condominio_id || 'cond-1',
      unidade: (user.user_metadata as any)?.unidade,
      registroProfissional: (user.user_metadata as any)?.registroProfissional,
      expiraEm,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };

    return {
      sessao,
      usuarioNovo: false, // O Supabase não informa se é novo usuário no login
    };
  }
}
