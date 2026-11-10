import { Vistoria } from '../../domain/entities/vistoria.entity';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface DevolverVistoriaInput {
  vistoriaId: string;
  solicitanteId: string;
  motivo: string;
  deviceId: string;
}

export class DevolverVistoriaUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly outboxRepo: IOutboxRepository
  ) { }

  public async executar(input: DevolverVistoriaInput): Promise<Vistoria> {
    const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
    if (!vistoria) {
      throw new Error(`Vistoria ${input.vistoriaId} não encontrada.`);
    }

    vistoria.devolver(input.motivo, input.solicitanteId);
    await this.vistoriaRepo.salvar(vistoria);

    await this.outboxRepo.enfileirar({
      tabela: 'vistorias',
      operacao: 'UPDATE',
      idRegistro: vistoria.id,
      usuarioId: input.solicitanteId,
      deviceId: input.deviceId,
      payload: {
        tipo: 'VISTORIA_DEVOLVIDA',
        vistoriaId: vistoria.id,
        solicitanteId: input.solicitanteId,
        motivo: input.motivo,
      },
    });
    return vistoria;
  }
}