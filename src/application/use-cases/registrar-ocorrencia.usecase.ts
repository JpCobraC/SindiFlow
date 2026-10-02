import { GravidadeOcorrencia, Ocorrencia } from '../../domain/entities/ocorrencia.entity';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';

export interface RegistrarOcorrenciaInput {
  id: string;
  vistoriaId: string;
  itemId?: string;
  titulo: string;
  descricao?: string;
  gravidade: GravidadeOcorrencia;
  fotos?: string[];
  usuarioId: string;
  deviceId: string;
}

export class RegistrarOcorrenciaUseCase {
  constructor(
    private readonly ocorrenciaRepo: IOcorrenciaRepository,
    private readonly outboxRepo: IOutboxRepository
  ) {}

  async executar(input: RegistrarOcorrenciaInput): Promise<Ocorrencia> {
    // 1. Cria a entidade Ocorrência (valida obrigatoriedade de fotos se for ALTA gravidade)
    const ocorrencia = Ocorrencia.criar({
      id: input.id,
      vistoriaId: input.vistoriaId,
      itemId: input.itemId,
      titulo: input.titulo,
      descricao: input.descricao,
      gravidade: input.gravidade,
      fotos: input.fotos,
    });

    // 2. Persiste na base local (SQLite via repositório)
    await this.ocorrenciaRepo.salvar(ocorrencia);

    // 3. Obrigação §1.3: Toda operação de escrita DEVE passar por fila de outbox
    await this.outboxRepo.enfileirar({
      tabela: 'ocorrencias',
      operacao: 'INSERT',
      payload: {
        id: ocorrencia.id,
        vistoriaId: ocorrencia.vistoriaId,
        itemId: ocorrencia.itemId,
        titulo: ocorrencia.titulo,
        descricao: ocorrencia.descricao,
        gravidade: ocorrencia.gravidade,
        status: ocorrencia.status,
        slaHoras: ocorrencia.slaHoras,
        dataLimiteSla: ocorrencia.dataLimiteSla.toISOString(),
        fotos: [...ocorrencia.fotos],
        dataCriacao: ocorrencia.dataCriacao.toISOString(),
      },
      usuarioId: input.usuarioId,
      deviceId: input.deviceId,
    });

    return ocorrencia;
  }
}
