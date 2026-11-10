/**
 * SindiFlow — UsuarioRepositorySQLite
 * Camada: Adapters (Repositories)
 *
 * Implementação de `UsuarioRepository` usando SQLite como fonte da verdade.
 *
 * Conformidade com §1.2: dados do usuário persistidos em SQLite,
 * nunca em AsyncStorage ou memória volátil.
 * Conformidade com §2: fica em `adapters/repositories/`, depende apenas
 * de `domain/interfaces/`.
 */

import { ISQLiteExecutor } from './sqlite-executor.interface';
import {
  UsuarioRepository,
  UsuarioDados,
} from '../../domain/interfaces/usuario.repository.interface';
import { RoleUsuario } from '../../domain/interfaces/auth.gateway.interface';

function iso(date?: Date): string | null {
  return date ? date.toISOString() : null;
}

export type LinhaUsuario = {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominio_id: string;
  unidade: string | null;
  registro_profissional: string | null;
  ativo: number; // 1 = true, 0 = false
  ultimo_acesso: string | null;
  criado_em: string;
};

export class UsuarioRepositorySQLite implements UsuarioRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(usuario: UsuarioDados): Promise<void> {
    await this.executor.emTransacao(async (tx) => {
      await tx.executar(
        `INSERT INTO users (
          id, nome, email, role, condominio_id, unidade,
          registro_profissional, ativo, ultimo_acesso, criado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          nome = excluded.nome,
          email = excluded.email,
          role = excluded.role,
          condominio_id = excluded.condominio_id,
          unidade = excluded.unidade,
          registro_profissional = excluded.registro_profissional,
          ativo = excluded.ativo,
          ultimo_acesso = excluded.ultimo_acesso`,
        [
          usuario.id,
          usuario.nome,
          usuario.email,
          usuario.role,
          usuario.condominioId,
          usuario.unidade ?? null,
          usuario.registroProfissional ?? null,
          usuario.ativo ? 1 : 0,
          iso(usuario.ultimoAcesso),
          iso(usuario.criadoEm),
        ]
      );
    });
  }

  async buscarPorId(id: string): Promise<UsuarioDados | null> {
    const linha = await this.executor.consultarUm<LinhaUsuario>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (!linha) return null;

    return this.hidratar(linha);
  }

  async buscarPorEmail(email: string): Promise<UsuarioDados | null> {
    const linha = await this.executor.consultarUm<LinhaUsuario>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!linha) return null;

    return this.hidratar(linha);
  }

  async listarPorCondominio(condominioId: string): Promise<UsuarioDados[]> {
    const linhas = await this.executor.consultar<LinhaUsuario>(
      'SELECT * FROM users WHERE condominio_id = ?',
      [condominioId]
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  async desativar(id: string): Promise<void> {
    await this.executor.executar(
      'UPDATE users SET ativo = 0 WHERE id = ?',
      [id]
    );
  }

  async reativar(id: string): Promise<void> {
    await this.executor.executar(
      'UPDATE users SET ativo = 1 WHERE id = ?',
      [id]
    );
  }

  private hidratar(linha: LinhaUsuario): UsuarioDados {
    return {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      role: linha.role,
      condominioId: linha.condominio_id,
      unidade: linha.unidade ?? undefined,
      registroProfissional: linha.registro_profissional ?? undefined,
      ativo: linha.ativo === 1,
      ultimoAcesso: linha.ultimo_acesso ? new Date(linha.ultimo_acesso) : undefined,
      criadoEm: new Date(linha.criado_em),
    };
  }
}
