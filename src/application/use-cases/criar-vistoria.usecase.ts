import { ItemChecklist } from '../../domain/entities/item-checklist.entity';
import { Vistoria } from '../../domain/entities/vistoria.entity';
import { ChecklistVazioError } from '../../domain/errors/domain-errors';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface CriarVistoriaInput {
  id: string;
  condominioId: string;
  inspetorId: string;
  itens: {
    id: string;
    titulo: string;
    categoria: string;
  }[];
  deviceId?: string;
}

export class CriarVistoriaUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly outboxRepo?: IOutboxRepository
  ) {}

  async executar(input: CriarVistoriaInput): Promise<Vistoria> {
    // Uma vistoria sem itens tem `percentualRespondido() === 0` e fica
    // permanentemente inapto a finalizar, sem diagnóstico algum. Melhor recusar.
    if (!input.itens || input.itens.length === 0) {
      throw new ChecklistVazioError(input.id);
    }

    const ids = input.itens.map((i) => i.id);
    const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicados.length > 0) {
      throw new ChecklistVazioError(`${input.id} (itens duplicados: ${duplicados.join(', ')})`);
    }

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

    // §1.3: toda escrita passa pela outbox. Sem este enfileiramento a linha
    // `vistorias` nunca chegava ao servidor — e a tabela ficaria vazia lá
    // enquanto os itens de checklist chegavam.
    if (this.outboxRepo) {
      await this.outboxRepo.enfileirar({
        tabela: 'vistorias',
        operacao: 'INSERT',
        // RF-SYNC-007: a chave de dedup cola na vistoria, não no evento.
        idRegistro: vistoria.id,
        payload: {
          id: vistoria.id,
          condominio_id: vistoria.condominioId,
          inspetor_id: vistoria.inspetorId,
          status: vistoria.status,
          data_criacao: vistoria.dataCriacao.toISOString(),
        },
        usuarioId: input.inspetorId,
        deviceId: input.deviceId ?? 'expo-device-01',
      });
    }

    return vistoria;
  }
}
