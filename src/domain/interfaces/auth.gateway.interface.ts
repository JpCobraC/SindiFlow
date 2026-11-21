/**
 * SindiFlow — Interfaces de Autenticação
 * Camada: Domain (Interfaces/Ports)
 *
 * Contratos puros de domínio para autenticação e para a credencial nativa do
 * Google. Nenhuma importação de SDK Expo, Supabase ou bibliotecas externas.
 *
 * Conformidade com §1.2: a sessão é persistida pelo adapter de armazenamento
 * seguro; o domínio só conhece o contrato.
 * Conformidade com §1.3: toda operação de escrita (criação/atualização de
 * usuário) passa pela fila de outbox.
 */

export type RoleUsuario = 'SINDICO' | 'CONDOMINO' | 'INSPETOR' | 'ADMIN';

export interface SessaoUsuario {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominioId: string;
  unidade?: string;
  registroProfissional?: string;
  /** Instante em que a sessão expira (7 dias após o login). */
  expiraEm: Date;
  /** Token de acesso (opaco para o domínio). */
  accessToken: string;
  /** Token de refresh para renovação da sessão. */
  refreshToken?: string;
}

/**
 * Porta de autenticação — implementada por `AuthGatewaySupabase`.
 *
 * O login social não pertence a esta porta: o adapter nativo do Google apenas
 * entrega o `idToken`, e a troca dele por uma sessão Supabase é feita aqui em
 * `loginComIdToken`. Assim, o caso de uso não depende de SDK de provedor.
 */
export interface AuthGateway {
  /**
   * Autentica usuário por e-mail e senha (convite do síndico).
   * Lança erro se credenciais inválidas ou usuário não existe.
   */
  loginPorEmail(email: string, senha: string): Promise<SessaoUsuario>;

  /**
   * Troca um ID token do Google por uma sessão Supabase.
   * Lança erro se o token for inválido ou o provedor não estiver configurado.
   */
  loginComIdToken(idToken: string): Promise<SessaoUsuario>;

  /**
   * Renova a sessão usando refresh token.
   * Lança erro se o refresh token for inválido ou expirado.
   */
  renovarSessao(refreshToken: string): Promise<SessaoUsuario>;

  /**
   * Encerra a sessão (logout).
   */
  logout(): Promise<void>;

  /**
   * Recupera a sessão salva localmente, se existir e não estiver expirada.
   * Retorna null se não houver sessão válida.
   */
  obterSessaoSalva(): Promise<SessaoUsuario | null>;

  /**
   * Verifica se existe uma sessão válida (não expirada).
   */
  temSessaoValida(): Promise<boolean>;
}

/**
 * Porta da credencial nativa do Google.
 *
 * Separada de `AuthGateway` de propósito: obter o `idToken` é responsabilidade
 * do SDK nativo; trocá-lo por sessão é responsabilidade do backend. O caso de
 * uso orquestra as duas portas sem conhecer nenhuma das implementações.
 */
export interface GoogleSignInGateway {
  /**
   * Abre o seletor de contas nativo e devolve o ID token do Google.
   *
   * Retorna `null` quando o usuário cancela o fluxo — cancelamento não é erro
   * de infraestrutura e não deve virar retry.
   */
  obterIdToken(): Promise<string | null>;
}
