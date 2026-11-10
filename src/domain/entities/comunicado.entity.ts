export interface ComunicadoProps {
  id: string;
  condominioId: string;
  autorId: string;
  autorNome: string;
  titulo: string;
  conteudo: string;
  dataCriacao?: Date;
  fixado?: boolean;
}

export class Comunicado {
  readonly id: string;
  readonly condominioId: string;
  readonly autorId: string;
  readonly autorNome: string;
  readonly titulo: string;
  readonly conteudo: string;
  readonly dataCriacao: Date;
  readonly fixado: boolean;

  constructor(props: ComunicadoProps) {
    if (!props.id || !props.titulo || !props.conteudo) {
      throw new Error('ID, título e conteúdo são obrigatórios.');
    }
    this.id = props.id.trim();
    this.condominioId = props.condominioId;
    this.autorId = props.autorId;
    this.autorNome = props.autorNome;
    this.titulo = props.titulo.trim();
    this.conteudo = props.conteudo.trim();
    this.dataCriacao = props.dataCriacao ? new Date(props.dataCriacao.getTime()) : new Date();
    this.fixado = props.fixado ?? false;
  }
}

