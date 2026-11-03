import {
  ItemChecklistNaoEncontradoError,
  OcorrenciaNaoEncontradaError,
  PermissaoNegadaError,
} from '../../domain/errors/domain-errors';
import { ICameraGateway } from '../../domain/interfaces/camera.gateway.interface';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { Evidencia } from '../../domain/value-objects/evidencia.vo';

export interface AnexarFotoInput {
  vistoriaId?: string;
  itemId?: string;
  ocorrenciaId?: string;
  usuarioId?: string;
  deviceId?: string;
}

/**
 * Cancelar a câmera não é erro. O contrato antigo devolvia `Promise<Evidencia>` e
 * obrigava o adapter a fabricar um `uri` ou lançar; com o resultado discriminado,
 * a tela distingue "usuário cancelou" de "câmera falhou" sem catch genérico.
 */
export type ResultadoAnexarFoto =
  | { status: 'anexada'; evidencia: Evidencia }
  | { status: 'cancelado' }
  | { status: 'erro_captura'; mensagem: string };

/** Nenhuma foto pode ser anexada sem um destino — ela seria perdida sem aviso. */
export class FotoSemDestinoError extends Error {
  constructor() {
    super('Não é possível anexar foto sem vincular a um item de vistoria ou a uma ocorrência.');
    this.name = 'FotoSemDestinoError';
  }
}

export class AnexarFotoUseCase {
  constructor(
    private readonly cameraGateway: ICameraGateway,
    private readonly vistoriaRepo?: IVistoriaRepository,
    private readonly ocorrenciaRepo?: IOcorrenciaRepository,
    private readonly outboxRepo?: IOutboxRepository
  ) {}

  async executar(input: AnexarFotoInput): Promise<ResultadoAnexarFoto> {
    // 1. Validar o destino ANTES de abrir a câmera. O fluxo anterior disparava o
    //    obturador e só depois descobria "vistoria não encontrada", deixando o
    //    arquivo no cache sem nenhum caminho de limpeza (cenário C-07).
    const destino = await this.localizarDestino(input);

    // 2. RNF02: verificar e solicitar permissão no primeiro uso.
    let temPermissao = await this.cameraGateway.temPermissao();
    if (!temPermissao) {
      temPermissao = await this.cameraGateway.solicitarPermissao();
      if (!temPermissao) {
        throw new PermissaoNegadaError('Câmera');
      }
    }

    // 3. RNF08 / §1.4: a compressão para 1080p é executada pelo adapter, via
    //    `expo-image-manipulator`. O parâmetro carrega a regra; o SDK é quem a
    //    aplica.
    const captura = await this.cameraGateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    if (captura.status === 'cancelado') {
      return { status: 'cancelado' };
    }
    if (captura.status === 'erro') {
      return { status: 'erro_captura', mensagem: captura.mensagem };
    }

    // 4. RF-EVI-001: hash e caminho local são obrigatórios.
    const evidencia = Evidencia.criar({
      id: `ev-${captura.foto.timestamp.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
      caminhoArquivoLocal: captura.foto.uri,
      hash: captura.foto.hash,
      timestamp: captura.foto.timestamp,
    });

    // 5. Persistir e enfileirar na outbox. §1.3: **toda** escrita passa pela
    //    fila. O fluxo anterior fazia 2 escritas e 0 enfileiramentos — toda foto
    //    capturada em campo era perda permanente.
    if (destino.item) {
      destino.item.adicionarEvidencia(evidencia);
      await this.vistoriaRepo!.salvar(destino.vistoria!);
    }
    if (destino.ocorrencia) {
      destino.ocorrencia.adicionarFoto(evidencia.caminhoArquivoLocal);
      await this.ocorrenciaRepo!.salvar(destino.ocorrencia);
    }

    if (this.outboxRepo) {
      await this.outboxRepo.enfileirar({
        tabela: 'fotos_evidencia',
        operacao: 'INSERT',
        // RF-SYNC-007: a chave de dedup cola na evidência, não no evento.
        idRegistro: evidencia.id,
        payload: {
          id: evidencia.id,
          item_id: destino.item?.id ?? null,
          ocorrencia_id: destino.ocorrencia?.id ?? null,
          caminho_arquivo: evidencia.caminhoArquivoLocal,
          hash: evidencia.hash,
          data_captura: evidencia.timestamp.toISOString(),
        },
        usuarioId: input.usuarioId ?? 'inspetor-carlos',
        deviceId: input.deviceId ?? 'expo-device-01',
      });
    }

    return { status: 'anexada', evidencia };
  }

  private async localizarDestino(input: AnexarFotoInput): Promise<{
    vistoria?: import('../../domain/entities/vistoria.entity').Vistoria;
    item?: import('../../domain/entities/item-checklist.entity').ItemChecklist;
    ocorrencia?: import('../../domain/entities/ocorrencia.entity').Ocorrencia;
  }> {
    if (input.vistoriaId && input.itemId) {
      if (!this.vistoriaRepo) throw new FotoSemDestinoError();
      const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
      if (!vistoria) {
        throw new OcorrenciaNaoEncontradaError(`vistoria:${input.vistoriaId}`);
      }
      const item = vistoria.itens.find((i) => i.id === input.itemId);
      if (!item) {
        throw new ItemChecklistNaoEncontradoError(input.itemId);
      }
      return { vistoria, item };
    }

    if (input.ocorrenciaId) {
      if (!this.ocorrenciaRepo) throw new FotoSemDestinoError();
      const ocorrencia = await this.ocorrenciaRepo.buscarPorId(input.ocorrenciaId);
      if (!ocorrencia) {
        throw new OcorrenciaNaoEncontradaError(input.ocorrenciaId);
      }
      return { ocorrencia };
    }

    throw new FotoSemDestinoError();
  }
}
