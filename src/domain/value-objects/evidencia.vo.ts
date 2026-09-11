export interface EvidenciaProps {
  id: string;
  caminhoArquivoLocal: string;
  timestamp?: Date;
  hash?: string;
}

export class Evidencia {
  readonly id: string;
  readonly caminhoArquivoLocal: string;
  readonly timestamp: Date;
  readonly hash?: string;

  private constructor(props: EvidenciaProps) {
    this.id = props.id;
    this.caminhoArquivoLocal = props.caminhoArquivoLocal;
    this.timestamp = props.timestamp || new Date();
    this.hash = props.hash;
  }

  public static criar(props: EvidenciaProps): Evidencia {
    return new Evidencia(props);
  }
}
