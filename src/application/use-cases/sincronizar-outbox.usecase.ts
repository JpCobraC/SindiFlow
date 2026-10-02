import { ConexaoIndisponivelError } from '../../domain/errors/domain-errors';
import { INetworkService } from '../../domain/interfaces/network.service.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export interface SincronizacaoResultado {
  totalItens: number;
  sucessos: number;
  falhas: number;
  detalhes: {
    id: string;
    sucesso: boolean;
    erro?: string;
  }[];

}

export class SincronizarOutboxUseCase {
  constructor(
    private readonly networkService: INetworkService,
    private readonly outboxRepo: IOutboxRepository,
    private readonly syncGateway: IRemoteSyncGateway
  ) {}

  async executar(): Promise<SincronizacaoResultado> {
    // 1. Obrigação §1.3: Detecção de rede obrigatória antes de toda tentativa de sync
    const online = await this.networkService.estaConectado();
    if (!online) {
      throw new ConexaoIndisponivelError();
    }

    // 2. Busca itens pendentes na fila da SQLite
    const pendentes = await this.outboxRepo.obterPendentes();
    const detalhes: SincronizacaoResultado['detalhes'] = [];
    let sucessos = 0;
    let falhas = 0;

    for (const item of pendentes) {
      try {
        await this.syncGateway.sincronizarItem(item);
        await this.outboxRepo.marcarSincronizado(item.id);
        sucessos++;
        detalhes.push({ id: item.id, sucesso: true });
      } catch (err: any) {
        falhas++;
        // Incrementa tentativa para acionar backoff exponencial
        await this.outboxRepo.incrementarTentativa(item.id);
        detalhes.push({
          id: item.id,
          sucesso: false,
          erro: err?.message || 'Erro desconhecido na sincronização remota',
        });
      }
    }

    return {
      totalItens: pendentes.length,
      sucessos,
      falhas,
      detalhes,
    };
  }
}
