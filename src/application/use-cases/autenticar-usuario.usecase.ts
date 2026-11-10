import { RoleUsuario, Usuario } from '../../domain/entities/usuario.entity';

export interface AutenticarUsuarioInput {
  email: string;
  senha?: string;
  role?: RoleUsuario;
}

export class AutenticarUsuarioUseCase {
  private static readonly USUARIOS_PADRAO: Array<{
    id: string;
    nome: string;
    email: string;
    role: RoleUsuario;
    condominioId: string;
    unidade?: string;
    registroProfissional?: string;
  }> = [
    {
      id: 'usr-sindico-carlos',
      nome: 'Dr. Carlos Alberto de Oliveira',
      email: 'sindico@solar.com',
      role: 'SINDICO',
      condominioId: 'cond-solar-palmeiras',
    },
    {
      id: 'usr-inspetor-carlos',
      nome: 'Eng. Carlos Eduardo Viana',
      email: 'inspetor@solar.com',
      role: 'INSPETOR',
      condominioId: 'cond-solar-palmeiras',
      registroProfissional: 'CREA 50692-SP',
    },
    {
      id: 'usr-condomino-mariana',
      nome: 'Mariana de Souza Ramos',
      email: 'condomino@solar.com',
      role: 'CONDOMINO',
      condominioId: 'cond-solar-palmeiras',
      unidade: 'Apto 402 - Bloco B',
    },
  ];

  public async executar(input: AutenticarUsuarioInput): Promise<Usuario> {
    const emailNormalizado = input.email.trim().toLowerCase();

    // Busca usuário padrão por email ou role
    const encontrado = AutenticarUsuarioUseCase.USUARIOS_PADRAO.find(
      (u) =>
        u.email === emailNormalizado ||
        (input.role && u.role === input.role)
    );

    if (encontrado) {
      return new Usuario({
        ...encontrado,
      });
    }

    // Permite login dinâmico caso seja outro email válido
    if (!emailNormalizado.includes('@')) {
      throw new Error('Email inválido.');
    }

    const role = input.role || 'CONDOMINO';
    return new Usuario({
      id: `usr-${Date.now()}`,
      nome: emailNormalizado.split('@')[0],
      email: emailNormalizado,
      role,
      condominioId: 'cond-solar-palmeiras',
    });
  }

  public static obterPerfisDemonstracao(): Usuario[] {
    return AutenticarUsuarioUseCase.USUARIOS_PADRAO.map((props) => new Usuario(props));
  }
}

