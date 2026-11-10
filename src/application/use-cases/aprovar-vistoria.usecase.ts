import { Vistoria } from '../../domain/entities/vistoria.entity';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface AprovarVistoriaInput {
  vistoriaId: string;
  aprovadorId: string;
  parecerTecnico?: string;
  deviceId: string;
}

export class AprovarVistoriaUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly outboxRepo: IOutboxRepository
  ) { }

  public async executar(input: AprovarVistoriaInput): Promise<Vistoria> {
    const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
    if (!vistoria) {
      throw new Error(`Vistoria ${input.vistoriaId} não encontrada.`);
    }

    vistoria.aprovar(input.parecerTecnico, input.aprovadorId);
    await this.vistoriaRepo.salvar(vistoria);

    await this.outboxRepo.enfileirar({
      tabela: 'vistorias',
      operacao: 'UPDATE',
      idRegistro: vistoria.id,
      usuarioId: input.aprovadorId,
      deviceId: input.deviceId,
      payload: {
        tipo: 'VISTORIA_APROVADA',
        vistoriaId: vistoria.id,
        aprovadorId: input.aprovadorId,
        parecerTecnico: input.parecerTecnico,
        dataAprovacao: vistoria.dataAprovacao?.toISOString(),
      },
    });
    return vistoria;
  }
}