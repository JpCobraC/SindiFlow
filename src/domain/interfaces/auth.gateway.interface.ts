/**
 * SindiFlow — Interface de Autenticação
 * Camada: Domain (Interfaces/Ports)
 *
 * Contrato puro de domínio para autenticação. Nenhuma importação
 * de SDK Expo, Supabase ou bibliotecas externas.
 *
 * Conformidade com §1.2: sessão de usuário armazenada em expo-secure-store,
 * nunca AsyncStorage.
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
 * Resultado da autenticação.
 */
export interface ResultadoAutenticacao {
  sessao: SessaoUsuario;
  /** Novo usuário cadastrado (convite aceito) ou null se já existia. */
  usuarioNovo: boolean;
}

/**
 * Porta de autenticação — implementada por AuthGatewaySupabase e AuthGatewayGoogle.
 */
export interface AuthGateway {
  /**
   * Autentica usuário por e-mail e senha (convite do síndico).
   * Lança erro se credenciais inválidas ou usuário não existe.
   */
  loginPorEmail(email: string, senha: string): Promise<ResultadoAutenticacao>;

  /**
   * Autentica usuário via provedor social (Google).
   * Retorna null se o usuário cancelou o fluxo OAuth.
   */
  loginComProvedorSocial(provedor: 'google'): Promise<ResultadoAutenticacao | null>;

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
