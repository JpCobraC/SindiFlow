/**
 * Duplos de teste compartilhados para as portas de autenticação.
 */
import {
  AuthGateway,
  GoogleSignInGateway,
  SessaoUsuario,
} from '../../src/domain/interfaces/auth.gateway.interface';

export const AGORA_TESTE = new Date('2026-11-20T12:00:00.000Z');

export function criarSessaoTeste(overrides?: Partial<SessaoUsuario>): SessaoUsuario {
  return {
    id: 'usr-1',
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
    role: 'SINDICO',
    condominioId: 'cond-1',
    unidade: 'Apto 101',
    expiraEm: new Date(AGORA_TESTE.getTime() + 7 * 24 * 60 * 60 * 1000),
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    ...overrides,
  };
}

export class AuthGatewayFake implements AuthGateway {
  sessao = criarSessaoTeste();
  erro: Error | null = null;

  loginPorEmail = jest.fn(async (_email: string, _senha: string) => {
    if (this.erro) throw this.erro;
    return this.sessao;
  });

  loginComIdToken = jest.fn(async (_idToken: string) => {
    if (this.erro) throw this.erro;
    return this.sessao;
  });

  renovarSessao = jest.fn(async (_refreshToken: string) => this.sessao);
  logout = jest.fn(async () => undefined);
  obterSessaoSalva = jest.fn(async (): Promise<SessaoUsuario | null> => this.sessao);
  obterSessaoSalvaBruta = jest.fn(async (): Promise<SessaoUsuario | null> => this.sessao);
  temSessaoValida = jest.fn(async () => true);
}

export class GoogleSignInGatewayFake implements GoogleSignInGateway {
  idToken: string | null = 'google-id-token';

  obterIdToken = jest.fn(async () => this.idToken);
}
