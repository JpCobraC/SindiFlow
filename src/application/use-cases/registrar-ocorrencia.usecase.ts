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
      // RF-SYNC-007: a chave de dedup cola na ocorrência, não no evento.
      idRegistro: ocorrencia.id,
      payload: {
        id: ocorrencia.id,
        vistoria_id: ocorrencia.vistoriaId,
        item_id: ocorrencia.itemId ?? null,
        titulo: ocorrencia.titulo,
        descricao: ocorrencia.descricao ?? null,
        gravidade: ocorrencia.gravidade,
        status: ocorrencia.status,
        sla_horas: ocorrencia.slaHoras,
        data_limite_sla: ocorrencia.dataLimiteSla.toISOString(),
        data_criacao: ocorrencia.dataCriacao.toISOString(),
      },
      usuarioId: input.usuarioId,
      deviceId: input.deviceId,
    });

    for (let idx = 0; idx < ocorrencia.fotos.length; idx++) {
      const caminho = ocorrencia.fotos[idx];
      const fotoId = `foto-${ocorrencia.id}-${idx}`;
      await this.outboxRepo.enfileirar({
        tabela: 'fotos_evidencia',
        operacao: 'INSERT',
        idRegistro: fotoId,
        payload: {
          id: fotoId,
          item_id: ocorrencia.itemId ?? null,
          ocorrencia_id: ocorrencia.id,
          caminho_arquivo: caminho,
          hash: caminho,
          data_captura: ocorrencia.dataCriacao.toISOString(),
        },
        usuarioId: input.usuarioId,
        deviceId: input.deviceId,
      });
    }

    return ocorrencia;
  }
}
