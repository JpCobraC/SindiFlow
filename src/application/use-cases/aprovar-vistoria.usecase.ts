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
        id: vistoria.id,
        condominio_id: vistoria.condominioId,
        inspetor_id: vistoria.inspetorId,
        status: vistoria.status,
        aprovado_por: input.aprovadorId,
        parecer_tecnico: input.parecerTecnico ?? null,
        data_aprovacao: vistoria.dataAprovacao?.toISOString() ?? null,
      },
    });
    return vistoria;
  }
}