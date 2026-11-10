/**
 * SindiFlow — Interface de Repositório de Usuário
 * Camada: Domain (Interfaces/Ports)
 *
 * Contrato puro de domínio para persistência de usuários.
 * Implementação fica em adapters/repositories/usuario.repository.sqlite.ts.
 *
 * Conformidade com §1.2: dados do usuário persistidos em SQLite,
 * nunca em AsyncStorage ou memória volátil.
 */

import { RoleUsuario } from './auth.gateway.interface';

export interface UsuarioDados {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominioId: string;
  unidade?: string;
  registroProfissional?: string;
  ativo: boolean;
  /** Último acesso registrado. */
  ultimoAcesso?: Date;
  /** Data de criação da conta. */
  criadoEm: Date;
}

/**
 * Porta de repositório de usuário.
 */
export interface UsuarioRepository {
  /** Salva ou atualiza um usuário. */
  salvar(usuario: UsuarioDados): Promise<void>;

  /** Busca usuário por ID. Retorna null se não encontrar. */
  buscarPorId(id: string): Promise<UsuarioDados | null>;

  /** Busca usuário por email. Retorna null se não encontrar. */
  buscarPorEmail(email: string): Promise<UsuarioDados | null>;

  /** Lista todos os usuários do condomínio. */
  listarPorCondominio(condominioId: string): Promise<UsuarioDados[]>;

  /** Desativa um usuário (revogação). */
  desativar(id: string): Promise<void>;

  /** Reativa um usuário desativado. */
  reativar(id: string): Promise<void>;
}
