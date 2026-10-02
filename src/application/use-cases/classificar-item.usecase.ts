import { StatusItemChecklist } from '../../domain/entities/item-checklist.entity';
import { Vistoria } from '../../domain/entities/vistoria.entity';
import { ItemChecklistNaoEncontradoError } from '../../domain/errors/domain-errors';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface ClassificarItemInput {
  vistoriaId: string;
  itemId: string;
  status: StatusItemChecklist;
  observacao?: string;
  usuarioId: string;
  deviceId: string;
}

export class ClassificarItemChecklistUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  async executar(input: ClassificarItemInput): Promise<Vistoria> {
    const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
    if (!vistoria) {
      throw new Error(`Vistoria com id ${input.vistoriaId} não encontrada.`);
    }

    const item = vistoria.itens.find((i) => i.id === input.itemId);
    if (!item) {
      throw new ItemChecklistNaoEncontradoError(input.itemId);
    }

    // Marca status (valida se CRÍTICO tem observação conforme RF-VIST-003)
    item.marcarStatus(input.status, input.observacao);

    // Salva vistoria atualizada
    await this.vistoriaRepo.salvar(vistoria);

    // Enfileira na outbox
    await this.outboxRepo.enfileirar({
      tabela: 'item_checklist',
      operacao: 'UPDATE',
      payload: {
        id: item.id,
        vistoriaId: input.vistoriaId,
        status: item.status,
        observacao: item.observacao || null,
        percentualVistoria: vistoria.percentualRespondido(),
      },
      usuarioId: input.usuarioId,
      deviceId: input.deviceId,
    });

    return vistoria;
  }
}
