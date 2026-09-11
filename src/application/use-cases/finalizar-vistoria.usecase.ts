import { Vistoria } from '../../domain/entities/vistoria.entity';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { Geolocalizacao } from '../../domain/value-objects/geolocalizacao.vo';

export interface FinalizarVistoriaInput {
  vistoriaId: string;
  latitude: number;
  longitude: number;
  precisao?: number;
  deviceId: string;
}

export class FinalizarVistoriaUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  async executar(input: FinalizarVistoriaInput): Promise<Vistoria> {
    const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
    if (!vistoria) {
      throw new Error(`Vistoria com ID ${input.vistoriaId} não encontrada`);
    }

    const geo = Geolocalizacao.criar({
      latitude: input.latitude,
      longitude: input.longitude,
      precisao: input.precisao,
    });

    // Aplica regras de domínio (RF-VIST-002, 003, 004)
    vistoria.finalizar(geo);

    // Persiste alteração localmente no banco
    await this.vistoriaRepo.salvar(vistoria);

    // Enfileira alteração no Outbox para sincronização com Supabase (1.3 & 3.3)
    await this.outboxRepo.enfileirar({
      tabela: 'vistorias',
      operacao: 'UPDATE',
      payload: {
        id: vistoria.id,
        condominio_id: vistoria.condominioId,
        status: vistoria.status,
        data_finalizacao: vistoria.dataFinalizacao?.toISOString(),
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
      usuarioId: vistoria.inspetorId,
      deviceId: input.deviceId,
    });

    return vistoria;
  }
}
