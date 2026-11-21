/**
 * SindiFlow — AutenticarUsuarioUseCase
 * Camada: Application (Use Cases)
 *
 * Orquestra duas portas independentes:
 * - `AuthGateway` (Supabase): e-mail/senha e troca do ID token do Google;
 * - `GoogleSignInGateway` (nativo): obtenção do ID token.
 *
 * `usuarioNovo` é derivado do repositório local, nunca do provedor remoto: o
 * Supabase não informa de forma confiável se a conta acabou de ser criada, e
 * inferir isso do login fazia o `criadoEm` ser regravado a cada acesso.
 *
 * Conformidade com §2: depende apenas de interfaces do `domain/`.
 * Conformidade com §1.3: toda escrita local de usuário gera evento na outbox
 * (INSERT na primeira vez, UPDATE nas seguintes).
 */

import {
  AuthGateway,
  GoogleSignInGateway,
  SessaoUsuario,
} from '../../domain/interfaces/auth.gateway.interface';
import {
  UsuarioDados,
  UsuarioRepository,
} from '../../domain/interfaces/usuario.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AutenticacaoCanceladaError } from '../../domain/errors/domain-errors';

export type AutenticarUsuarioInput =
  | { metodo: 'email'; email: string; senha: string }
  | { metodo: 'google' };

export type Relogio = () => Date;

export class AutenticarUsuarioUseCase {
  constructor(
    private readonly authGateway: AuthGateway,
    private readonly googleGateway: GoogleSignInGateway,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly outboxRepo: IOutboxRepository,
    private readonly deviceId: string,
    private readonly agora: Relogio = () => new Date()
  ) {}

  async executar(input: AutenticarUsuarioInput): Promise<Usuario> {
    const sessao =
      input.metodo === 'email'
        ? await this.autenticarPorEmail(input.email, input.senha)
        : await this.autenticarComGoogle();

    return this.persistirSessao(sessao);
  }

  /**
   * Recupera a sessão persistida e devolve o usuário local correspondente.
   * Retorna `null` quando não há sessão válida ou quando o usuário ainda não
   * foi materializado no SQLite (sessão órfã).
   */
  async restaurarSessao(): Promise<Usuario | null> {
    const sessao = await this.authGateway.obterSessaoSalva();
    if (sessao) {
      const dados = await this.usuarioRepo.buscarPorId(sessao.id);
      if (!dados) {
        await this.authGateway.logout();
        return null;
      }
      return this.mapearUsuario(dados);
    }

    // Sessao pode estar expirada (access token vencido) mas ainda renovavel.
    const bruta = await this.authGateway.obterSessaoSalvaBruta();
    if (!bruta) return null;

    if (!bruta.refreshToken) {
      await this.authGateway.logout();
      return null;
    }

    try {
      const renovada = await this.authGateway.renovarSessao(bruta.refreshToken);
      const dados = await this.usuarioRepo.buscarPorId(renovada.id);
      if (!dados) {
        await this.authGateway.logout();
        return null;
      }
      return this.mapearUsuario(dados);
    } catch {
      await this.authGateway.logout();
      return null;
    }
  }

  async encerrarSessao(): Promise<void> {
    await this.authGateway.logout();
  }

  private async autenticarPorEmail(
    email: string,
    senha: string
  ): Promise<SessaoUsuario> {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) {
      throw new Error('Informe o e-mail.');
    }
    if (!senha) {
      throw new Error('Informe a senha.');
    }

    return this.authGateway.loginPorEmail(emailNormalizado, senha);
  }

  private async autenticarComGoogle(): Promise<SessaoUsuario> {
    const idToken = await this.googleGateway.obterIdToken();
    if (!idToken) {
      throw new AutenticacaoCanceladaError();
    }

    return this.authGateway.loginComIdToken(idToken);
  }

  private async persistirSessao(sessao: SessaoUsuario): Promise<Usuario> {
    const agora = this.agora();
    const existente = await this.usuarioRepo.buscarPorId(sessao.id);
    const usuarioNovo = existente === null;

    const dados: UsuarioDados = {
      id: sessao.id,
      nome: sessao.nome,
      email: sessao.email,
      role: sessao.role,
      condominioId: sessao.condominioId,
      unidade: sessao.unidade,
      registroProfissional: sessao.registroProfissional,
      ativo: true,
      ultimoAcesso: agora,
      criadoEm: existente?.criadoEm ?? agora,
    };

    await this.usuarioRepo.salvar(dados);

    await this.outboxRepo.enfileirar({
      tabela: 'users',
      operacao: usuarioNovo ? 'INSERT' : 'UPDATE',
      idRegistro: sessao.id,
      payload: {
        id: sessao.id,
        nome: sessao.nome,
        email: sessao.email,
        role: sessao.role,
        condominio_id: sessao.condominioId,
        ultimo_acesso: agora.toISOString(),
      },
      usuarioId: sessao.id,
      deviceId: this.deviceId,
    });

    return this.mapearUsuario(dados);
  }

  private mapearUsuario(dados: UsuarioDados): Usuario {
    return new Usuario({
      id: dados.id,
      nome: dados.nome,
      email: dados.email,
      role: dados.role,
      condominioId: dados.condominioId,
      unidade: dados.unidade,
      registroProfissional: dados.registroProfissional,
      ativo: dados.ativo,
    });
  }
}
