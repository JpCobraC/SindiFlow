import { Ocorrencia } from '../../domain/entities/ocorrencia.entity';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';

export class OcorrenciaRepositoryInMemory implements IOcorrenciaRepository {
  public itens: Map<string, Ocorrencia> = new Map();

  async salvar(ocorrencia: Ocorrencia): Promise<void> {
    this.itens.set(ocorrencia.id, ocorrencia);
  }

  async buscarPorId(id: string): Promise<Ocorrencia | null> {
    return this.itens.get(id) || null;
  }

  async listarPorVistoria(vistoriaId: string): Promise<Ocorrencia[]> {
    return Array.from(this.itens.values()).filter((o) => o.vistoriaId === vistoriaId);
  }

  async listarTodas(): Promise<Ocorrencia[]> {
    return Array.from(this.itens.values());
  }
}
