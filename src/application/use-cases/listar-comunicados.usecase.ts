import { Comunicado } from '../../domain/entities/comunicado.entity';
import { IComunicadoRepository } from '../../domain/interfaces/comunicado.repository.interface';

export class ListarComunicadosUseCase {
  constructor(private readonly comunicadoRepo: IComunicadoRepository) {}

  async executar(condominioId: string): Promise<Comunicado[]> {
    return this.comunicadoRepo.listarPorCondominio(condominioId);
  }
}
