import { IOutboxRepository, ItemOutbox } from '../../domain/interfaces/outbox.repository.interface';

export class OutboxRepositoryInMemory implements IOutboxRepository {
  public itens: ItemOutbox[] = [];
  private sequence = 1;

  async enfileirar(item: Omit<ItemOutbox, 'id' | 'tentativas' | 'dataCriacao'>): Promise<void> {
    this.itens.push({
      ...item,
      id: `outbox-${this.sequence++}`,
      tentativas: 0,
      dataCriacao: new Date(),
    });
  }

  async obterPendentes(limite: number = 50): Promise<ItemOutbox[]> {
    return this.itens.slice(0, limite);
  }

  async marcarSincronizado(id: string): Promise<void> {
    this.itens = this.itens.filter((item) => item.id !== id);
  }

  async incrementarTentativa(id: string): Promise<void> {
    const item = this.itens.find((i) => i.id === id);
    if (item) {
      item.tentativas += 1;
    }
  }
}
