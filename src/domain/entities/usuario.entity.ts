export type RoleUsuario = 'SINDICO' | 'CONDOMINO' | 'INSPETOR' | 'ADMIN';

export interface UsuarioProps {
  id: string;
  nome: string;
  email: string;
  role: RoleUsuario;
  condominioId: string;
  unidade?: string;
  registroProfissional?: string; // ex: CREA para Inspetor
  avatarUrl?: string;
  ativo?: boolean;
}

export class Usuario {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly role: RoleUsuario;
  readonly condominioId: string;
  readonly unidade?: string;
  readonly registroProfissional?: string;
  readonly avatarUrl?: string;
  private _ativo: boolean;

  constructor(props: UsuarioProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('ID do usuário é obrigatório.');
    }
    if (!props.nome || props.nome.trim().length === 0) {
      throw new Error('Nome do usuário é obrigatório.');
    }
    if (!props.email || !props.email.includes('@')) {
      throw new Error('Email inválido.');
    }
    if (!props.role) {
      throw new Error('Papel (Role) do usuário é obrigatório.');
    }
    if (!props.condominioId || props.condominioId.trim().length === 0) {
      throw new Error('Condomínio ID é obrigatório.');
    }

    this.id = props.id.trim();
    this.nome = props.nome.trim();
    this.email = props.email.trim().toLowerCase();
    this.role = props.role;
    this.condominioId = props.condominioId.trim();
    this.unidade = props.unidade?.trim();
    this.registroProfissional = props.registroProfissional?.trim();
    this.avatarUrl = props.avatarUrl;
    this._ativo = props.ativo !== undefined ? props.ativo : true;
  }

  public get ativo(): boolean {
    return this._ativo;
  }

  public desativar(): void {
    this._ativo = false;
  }

  public ativar(): void {
    this._ativo = true;
  }

  public isSindico(): boolean {
    return this.role === 'SINDICO' || this.role === 'ADMIN';
  }

  public isInspetor(): boolean {
    return this.role === 'INSPETOR' || this.role === 'ADMIN';
  }

  public isCondomino(): boolean {
    return this.role === 'CONDOMINO';
  }

  public podeAprovarVistoria(): boolean {
    return this.isSindico();
  }

  public podePreencherChecklist(): boolean {
    return this.isInspetor();
  }

  public podeVisualizarLaudo(statusVistoria: string): boolean {
    if (this.isSindico() || this.isInspetor()) {
      return true;
    }
    // Condômino só pode visualizar laudos aprovados pelo síndico (RF15)
    return statusVistoria === 'APROVADA' || statusVistoria === 'FINALIZADA';
  }
}

