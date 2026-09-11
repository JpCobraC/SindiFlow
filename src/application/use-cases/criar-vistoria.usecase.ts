import { ItemChecklist } from '../../domain/entities/item-checklist.entity';
import { Vistoria } from '../../domain/entities/vistoria.entity';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface CriarVistoriaInput {
  id: string;
  condominioId: string;
  inspetorId: string;
  itens: Array<{
    id: string;
    titulo: string;
    categoria: string;
  }>;
}

export class CriarVistoriaUseCase {
  constructor(private readonly vistoriaRepo: IVistoriaRepository) {}

  async executar(input: CriarVistoriaInput): Promise<Vistoria> {
    const itensChecklist = input.itens.map((item) =>
      ItemChecklist.criar({
        id: item.id,
        vistoriaId: input.id,
        titulo: item.titulo,
        categoria: item.categoria,
      })
    );

    const vistoria = Vistoria.criar({
      id: input.id,
      condominioId: input.condominioId,
      inspetorId: input.inspetorId,
      itens: itensChecklist,
    });

    await this.vistoriaRepo.salvar(vistoria);
    return vistoria;
  }
}
