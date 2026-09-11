export interface ItemOutbox {
  id: string;
  tabela: string;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  usuarioId: string;
  deviceId: string;
  tentativas: number;
  dataCriacao: Date;
}

export interface IOutboxRepository {
  enfileirar(item: Omit<ItemOutbox, 'id' | 'tentativas' | 'dataCriacao'>): Promise<void>;
  obterPendentes(limite?: number): Promise<ItemOutbox[]>;
  marcarSincronizado(id: string): Promise<void>;
  incrementarTentativa(id: string): Promise<void>;
}
