import { Ocorrencia } from '../entities/ocorrencia.entity';

export interface IOcorrenciaRepository {
  salvar(ocorrencia: Ocorrencia): Promise<void>;
  buscarPorId(id: string): Promise<Ocorrencia | null>;
  listarPorVistoria(vistoriaId: string): Promise<Ocorrencia[]>;
  listarTodas(): Promise<Ocorrencia[]>;
}
