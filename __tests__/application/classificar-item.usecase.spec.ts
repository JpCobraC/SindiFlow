import { ClassificarItemChecklistUseCase } from '../../src/application/use-cases/classificar-item.usecase';
import { ItemChecklist, StatusItemChecklist } from '../../src/domain/entities/item-checklist.entity';
import { StatusVistoria, Vistoria } from '../../src/domain/entities/vistoria.entity';
import { ItemCriticoSemObservacaoError } from '../../src/domain/errors/domain-errors';
import { IOutboxRepository, ItemOutbox } from '../../src/domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../src/domain/interfaces/vistoria.repository.interface';

class FakeVistoriaRepository implements IVistoriaRepository {
  public vistorias: Vistoria[] = [];

  async salvar(vistoria: Vistoria): Promise<void> {
    const idx = this.vistorias.findIndex((v) => v.id === vistoria.id);
    if (idx >= 0) this.vistorias[idx] = vistoria;
    else this.vistorias.push(vistoria);
  }

  async buscarPorId(id: string): Promise<Vistoria | null> {
    return this.vistorias.find((v) => v.id === id) || null;
  }

  async listarPorCondominio(condominioId: string): Promise<Vistoria[]> {
    return this.vistorias.filter((v) => v.condominioId === condominioId);
  }
}

class FakeOutboxRepository implements IOutboxRepository {
  public itens: ItemOutbox[] = [];

  async enfileirar(item: Omit<ItemOutbox, 'id' | 'tentativas' | 'dataCriacao'>): Promise<void> {
    this.itens.push({
      ...item,
      id: `out-${this.itens.length + 1}`,
      tentativas: 0,
      dataCriacao: new Date(),
    });
  }

  async obterPendentes(): Promise<ItemOutbox[]> {
    return this.itens;
  }

  async marcarSincronizado(): Promise<void> {}
  async incrementarTentativa(): Promise<void> {}
}

describe('ClassificarItemChecklistUseCase (Application)', () => {
  let vistoriaRepo: FakeVistoriaRepository;
  let outboxRepo: FakeOutboxRepository;
  let useCase: ClassificarItemChecklistUseCase;

  beforeEach(async () => {
    vistoriaRepo = new FakeVistoriaRepository();
    outboxRepo = new FakeOutboxRepository();
    useCase = new ClassificarItemChecklistUseCase(vistoriaRepo, outboxRepo);

    const item1 = ItemChecklist.criar({
      id: 'item-1',
      vistoriaId: 'vist-1',
      titulo: 'Extintor de Incêndio - Validade',
      categoria: 'Segurança',
    });

    const item2 = ItemChecklist.criar({
      id: 'item-2',
      vistoriaId: 'vist-1',
      titulo: 'Bomba de Recalque',
      categoria: 'Hidráulica',
    });

    const vistoria = Vistoria.criar({
      id: 'vist-1',
      condominioId: 'cond-1',
      inspetorId: 'user-1',
      status: StatusVistoria.RASCUNHO,
      itens: [item1, item2],
    });

    await vistoriaRepo.salvar(vistoria);
  });

  it('deve marcar item como OK com sucesso e enfileirar na outbox', async () => {
    const vistoria = await useCase.executar({
      vistoriaId: 'vist-1',
      itemId: 'item-1',
      status: StatusItemChecklist.OK,
      usuarioId: 'user-1',
      deviceId: 'dev-1',
    });

    const itemAtualizado = vistoria.itens.find((i) => i.id === 'item-1');
    expect(itemAtualizado?.status).toBe(StatusItemChecklist.OK);
    expect(outboxRepo.itens.length).toBe(1);
    expect(outboxRepo.itens[0].tabela).toBe('item_checklist');
  });

  it('deve bloquear status CRITICO se não for fornecida observação/justificativa (RF-VIST-003)', async () => {
    await expect(
      useCase.executar({
        vistoriaId: 'vist-1',
        itemId: 'item-2',
        status: StatusItemChecklist.CRITICO,
        usuarioId: 'user-1',
        deviceId: 'dev-1',
      })
    ).rejects.toThrow(ItemCriticoSemObservacaoError);

    expect(outboxRepo.itens.length).toBe(0);
  });

  it('deve marcar status CRITICO com sucesso quando observação for fornecida', async () => {
    const vistoria = await useCase.executar({
      vistoriaId: 'vist-1',
      itemId: 'item-2',
      status: StatusItemChecklist.CRITICO,
      observacao: 'Bomba apresentando vazamento no retentor e ruído excessivo',
      usuarioId: 'user-1',
      deviceId: 'dev-1',
    });

    const itemAtualizado = vistoria.itens.find((i) => i.id === 'item-2');
    expect(itemAtualizado?.status).toBe(StatusItemChecklist.CRITICO);
    expect(itemAtualizado?.observacao).toContain('ruído excessivo');
    expect(outboxRepo.itens.length).toBe(1);
  });
});
