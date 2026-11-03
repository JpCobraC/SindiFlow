import { EvidenciaSemHashError } from '../errors/domain-errors';

export interface EvidenciaProps {
  id: string;
  caminhoArquivoLocal: string;
  timestamp?: Date;
  /**
   * RF-EVI-001 — obrigatório. O DDL declara `hash TEXT NOT NULL`, então um VO que
   * aceita ausência desloca o erro da validação (barato, com mensagem) para a
   * gravação (caro, e sem mensagem de domínio). Ver `EvidenciaSemHashError`.
   */
  hash: string;
}

export class Evidencia {
  readonly id: string;
  readonly caminhoArquivoLocal: string;
  readonly timestamp: Date;
  readonly hash: string;

  private constructor(props: EvidenciaProps) {
    if (!props.hash || props.hash.trim().length === 0) {
      throw new EvidenciaSemHashError();
    }

    this.id = props.id;
    this.caminhoArquivoLocal = props.caminhoArquivoLocal;
    // `readonly timestamp: Date` não protege: `readonly` impede reatribuir a
    // referência, não `setFullYear`. O clone é o mesmo motivo pelo qual o Lote 6
    // clonou `dataCriacao` em `Vistoria` e `Ocorrencia` — sem ele, um chamador
    // reescrevia a data de captura de uma evidência já persistida.
    this.timestamp = props.timestamp ? new Date(props.timestamp.getTime()) : new Date();
    this.hash = props.hash;
  }

  public static criar(props: EvidenciaProps): Evidencia {
    return new Evidencia(props);
  }
}
