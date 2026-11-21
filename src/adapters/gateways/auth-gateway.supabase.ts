/**
 * SindiFlow — AuthGatewaySupabase
 * Camada: Adapters (Gateways)
 *
 * Implementação de `AuthGateway` usando Supabase Auth.
 *
 * O login social chega aqui como `idToken` já obtido pelo SDK nativo do Google
 * (`GoogleSignInGateway`) e é trocado por sessão via `signInWithIdToken`. Não
 * existe navegador, deep link OAuth ou `signInWithOAuth` neste caminho.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 * Conformidade com §1.2: a sessão é persistida em `expo-secure-store` pelo
 * `SupabaseAuthStorage` injetado.
 * Conformidade com §2: fica em `adapters/`, depende de `domain/`.
 */

import {
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import {
  AuthGateway,
  RoleUsuario,
  SessaoUsuario,
} from '../../domain/interfaces/auth.gateway.interface';
import {
  SessaoInvalidaError,
  UsuarioSemCondominioError,
} from '../../domain/errors/domain-errors';

const ROLES_VALIDAS: ReadonlySet<RoleUsuario> = new Set([
  'SINDICO',
  'CONDOMINO',
  'INSPETOR',
  'ADMIN',
]);

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthGatewaySupabase implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loginPorEmail(email: string, senha: string): Promise<SessaoUsuario> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Falha na autenticação por e-mail.');
    }

    return this.mapearSessao(data.session, data.user);
  }

  async loginComIdToken(idToken: string): Promise<SessaoUsuario> {
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Falha ao autenticar com o Google.');
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

    if (error || !data.session || !data.session.user) {
      return null;
    }

    if (this.sessaoExpirada(data.session)) {
      return null;
    }

    return this.mapearSessao(data.session, data.session.user);
  }

  async obterSessaoSalvaBruta(): Promise<SessaoUsuario | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error || !data.session || !data.session.user) {
      return null;
    }

    return this.mapearSessao(data.session, data.session.user);
  }

  async temSessaoValida(): Promise<boolean> {
    const sessao = await this.obterSessaoSalva();
    if (!sessao) return false;

    return sessao.expiraEm.getTime() > Date.now();
  }

  private sessaoExpirada(session: Session): boolean {
    if (!session.expires_at) return false;
    return session.expires_at * 1000 <= Date.now();
  }

  private mapearSessao(session: Session, user: User): SessaoUsuario {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

    const email = user.email?.trim().toLowerCase();
    if (!email) {
      throw new SessaoInvalidaError('usuário sem e-mail.');
    }

    const condominioId = this.texto(metadata.condominio_id);
    if (!condominioId) {
      throw new UsuarioSemCondominioError();
    }

    const expiraEm = session.expires_at
      ? new Date(session.expires_at * 1000)
      : new Date(Date.now() + SETE_DIAS_MS);

    return {
      id: user.id,
      nome: this.texto(metadata.nome) ?? this.texto(metadata.full_name) ?? email.split('@')[0],
      email,
      role: this.mapearRole(metadata.role),
      condominioId,
      unidade: this.texto(metadata.unidade),
      registroProfissional: this.texto(metadata.registroProfissional),
      expiraEm,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };
  }

  private mapearRole(valor: unknown): RoleUsuario {
    if (valor === undefined || valor === null || valor === '') {
      return 'CONDOMINO';
    }

    if (typeof valor === 'string' && ROLES_VALIDAS.has(valor as RoleUsuario)) {
      return valor as RoleUsuario;
    }

    throw new SessaoInvalidaError(`role desconhecida: ${String(valor)}.`);
  }

  private texto(valor: unknown): string | undefined {
    if (typeof valor !== 'string') return undefined;
    const limpo = valor.trim();
    return limpo.length > 0 ? limpo : undefined;
  }
}
