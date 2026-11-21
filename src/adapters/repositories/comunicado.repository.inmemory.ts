import { Comunicado } from '../../domain/entities/comunicado.entity';
import { IComunicadoRepository } from '../../domain/interfaces/comunicado.repository.interface';

export class ComunicadoRepositoryInMemory implements IComunicadoRepository {
  private itens: Map<string, Comunicado> = new Map();

  async salvar(comunicado: Comunicado): Promise<void> {
    this.itens.set(comunicado.id, comunicado);
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    return this.itens.get(id) ?? null;
  }

  async listarPorCondominio(condominioId: string): Promise<Comunicado[]> {
    return Array.from(this.itens.values()).filter(
      (c) => c.condominioId === condominioId
    );
  }

  limpar(): void {
    this.itens.clear();
  }
}
