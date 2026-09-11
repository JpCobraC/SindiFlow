import { Vistoria } from '../../domain/entities/vistoria.entity';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export class VistoriaRepositoryInMemory implements IVistoriaRepository {
  public vistorias: Map<string, Vistoria> = new Map();

  async salvar(vistoria: Vistoria): Promise<void> {
    this.vistorias.set(vistoria.id, vistoria);
  }

  async buscarPorId(id: string): Promise<Vistoria | null> {
    return this.vistorias.get(id) || null;
  }

  async listarPorCondominio(condominioId: string): Promise<Vistoria[]> {
    return Array.from(this.vistorias.values()).filter((v) => v.condominioId === condominioId);
  }
}
