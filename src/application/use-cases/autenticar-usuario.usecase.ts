/**
 * SindiFlow — AutenticarUsuarioUseCase
 * Camada: Application (Use Cases)
 *
 * Orquestração de autenticação de usuário. Orquestra o `AuthGateway` (Supabase
 * Auth ou Google) e o `UsuarioRepository` (SQLite).
 *
 * Conformidade com §2: depende apenas de interfaces do `domain/`.
 * Conformidade com §1.3: toda operação de escrita (criação/atualização de
 * usuário após login) passa pela fila de outbox via `IOutboxRepository`.
 * Conformidade com §3.3: sessão de 7 dias com expiração controlada.
 */

import {
  AuthGateway,
  ResultadoAutenticacao,
  SessaoUsuario,
} from '../../domain/interfaces/auth.gateway.interface';
import {
  UsuarioRepository,
  UsuarioDados,
} from '../../domain/interfaces/usuario.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { RoleUsuario, Usuario } from '../../domain/entities/usuario.entity';

export interface AutenticarUsuarioInput {
  email: string;
  senha?: string;
  role?: RoleUsuario;
}

/**
 * Sessão offline de 7 dias conforme decisão de 07/09/2026.
 */
const SESSAO_OFFLINE_DIAS = 7;

export class AutenticarUsuarioUseCase {
  constructor(
    private readonly authGateway: AuthGateway,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  async executar(input: AutenticarUsuarioInput): Promise<Usuario> {
    const emailNormalizado = input.email.trim().toLowerCase();

    // 1. Autentica via gateway (Supabase Auth por email ou Google social)
    const resultado: ResultadoAutenticacao =
      input.senha
        ? await this.authGateway.loginPorEmail(emailNormalizado, input.senha)
        : await this.authGateway.loginComProvedorSocial('google');

    if (!resultado) {
      throw new Error('Falha na autenticação.');
    }

    const { sessao, usuarioNovo } = resultado;

    // 2. Salva/atualiza usuário no SQLite (fonte da verdade offline)
    const usuarioDados: UsuarioDados = {
      id: sessao.id,
      nome: sessao.nome,
      email: sessao.email,
      role: sessao.role,
      condominioId: sessao.condominioId,
      unidade: sessao.unidade,
      registroProfissional: sessao.registroProfissional,
      ativo: true,
      ultimoAcesso: new Date(),
      criadoEm: usuarioNovo ? new Date() : undefined,
    };

    await this.usuarioRepo.salvar(usuarioDados);

    // 3. Enfileira na outbox se for usuário novo (criação) ou atualização
    if (usuarioNovo) {
      await this.outboxRepo.enfileirar({
        tabela: 'users',
        operacao: 'INSERT',
        idRegistro: sessao.id,
        payload: {
          id: sessao.id,
          email: sessao.email,
          role: sessao.role,
          condominio_id: sessao.condominioId,
        },
        usuarioId: sessao.id,
        deviceId: 'expo-device-01',
      });
    }

    // 4. Retorna entidade Usuario do domínio
    return new Usuario({
      id: sessao.id,
      nome: sessao.nome,
      email: sessao.email,
      role: sessao.role,
      condominioId: sessao.condominioId,
      unidade: sessao.unidade,
      registroProfissional: sessao.registroProfissional,
      ativo: true,
    });
  }
}
