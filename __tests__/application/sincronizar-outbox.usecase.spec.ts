import { SincronizarOutboxUseCase } from '../../src/application/use-cases/sincronizar-outbox.usecase';
import { ConexaoIndisponivelError } from '../../src/domain/errors/domain-errors';
import { INetworkService } from '../../src/domain/interfaces/network.service.interface';
import { IOutboxRepository, ItemOutbox } from '../../src/domain/interfaces/outbox.repository.interface';
import { IRemoteSyncGateway } from '../../src/domain/interfaces/remote-sync.gateway.interface';

class FakeNetworkService implements INetworkService {
  public conectado = true;

  async estaConectado(): Promise<boolean> {
    return this.conectado;
  }
}

class FakeOutboxRepository implements IOutboxRepository {
  public itens: ItemOutbox[] = [];
  public sincronizados: string[] = [];
  public tentativas: Record<string, number> = {};

  async enfileirar(item: Omit<ItemOutbox, 'id' | 'tentativas' | 'dataCriacao'>): Promise<void> {
    const id = `out-${this.itens.length + 1}`;
    this.itens.push({
      ...item,
      id,
      tentativas: 0,
      dataCriacao: new Date(),
    });
  }

  async obterPendentes(): Promise<ItemOutbox[]> {
    return this.itens.filter((i) => !this.sincronizados.includes(i.id) && (this.tentativas[i.id] || 0) < 5);
  }

  async marcarSincronizado(id: string): Promise<void> {
    this.sincronizados.push(id);
  }

  async incrementarTentativa(id: string): Promise<void> {
    this.tentativas[id] = (this.tentativas[id] || 0) + 1;
  }
}

class FakeRemoteSyncGateway implements IRemoteSyncGateway {
  public deveFalhar = false;
  public itensProcessados: ItemOutbox[] = [];

  async sincronizarItem(item: ItemOutbox): Promise<boolean> {
    this.itensProcessados.push(item);
    if (this.deveFalhar) {
      throw new Error('Supabase 503 Service Unavailable');
    }
    return true;
  }
}

describe('SincronizarOutboxUseCase (Application)', () => {
  let networkService: FakeNetworkService;
  let outboxRepo: FakeOutboxRepository;
  let syncGateway: FakeRemoteSyncGateway;
  let useCase: SincronizarOutboxUseCase;

  beforeEach(() => {
    networkService = new FakeNetworkService();
    outboxRepo = new FakeOutboxRepository();
    syncGateway = new FakeRemoteSyncGateway();
    useCase = new SincronizarOutboxUseCase(networkService, outboxRepo, syncGateway);
  });

  it('deve abortar e lançar erro se a rede estiver offline (Seção 1.3)', async () => {
    networkService.conectado = false;

    await expect(useCase.executar()).rejects.toThrow(ConexaoIndisponivelError);
    expect(syncGateway.itensProcessados.length).toBe(0);
  });

  it('deve sincronizar com sucesso todos os itens pendentes quando houver conexão', async () => {
    networkService.conectado = true;
    await outboxRepo.enfileirar({
      tabela: 'vistorias',
      operacao: 'INSERT',
      payload: { id: 'v-1' },
      usuarioId: 'u-1',
      deviceId: 'd-1',
    });
    await outboxRepo.enfileirar({
      tabela: 'ocorrencias',
      operacao: 'INSERT',
      payload: { id: 'oc-1' },
      usuarioId: 'u-1',
      deviceId: 'd-1',
    });

    const resultado = await useCase.executar();

    expect(resultado.totalItens).toBe(2);
    expect(resultado.sucessos).toBe(2);
    expect(resultado.falhas).toBe(0);
    expect(outboxRepo.sincronizados.length).toBe(2);
  });

  it('deve registrar tentativa em caso de falha remota para retry exponencial futuro', async () => {
    networkService.conectado = true;
    syncGateway.deveFalhar = true;

    await outboxRepo.enfileirar({
      tabela: 'ocorrencias',
      operacao: 'INSERT',
      payload: { id: 'oc-2' },
      usuarioId: 'u-1',
      deviceId: 'd-1',
    });

    const resultado = await useCase.executar();

    expect(resultado.totalItens).toBe(1);
    expect(resultado.sucessos).toBe(0);
    expect(resultado.falhas).toBe(1);
    expect(outboxRepo.tentativas['out-1']).toBe(1);
    expect(outboxRepo.sincronizados.length).toBe(0);
  });
});
