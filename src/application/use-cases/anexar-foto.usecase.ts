import {
  ItemChecklistNaoEncontradoError,
  OcorrenciaNaoEncontradaError,
  PermissaoNegadaError,
} from '../../domain/errors/domain-errors';
import { ICameraGateway } from '../../domain/interfaces/camera.gateway.interface';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { Evidencia } from '../../domain/value-objects/evidencia.vo';

export interface AnexarFotoInput {
  vistoriaId?: string;
  itemId?: string;
  ocorrenciaId?: string;
}

export class AnexarFotoUseCase {
  constructor(
    private readonly cameraGateway: ICameraGateway,
    private readonly vistoriaRepo?: IVistoriaRepository,
    private readonly ocorrenciaRepo?: IOcorrenciaRepository
  ) {}

  async executar(input: AnexarFotoInput): Promise<Evidencia> {
    // 1. RNF02: Verificar e solicitar permissão no primeiro uso
    let temPermissao = await this.cameraGateway.temPermissao();
    if (!temPermissao) {
      temPermissao = await this.cameraGateway.solicitarPermissao();
      if (!temPermissao) {
        throw new PermissaoNegadaError('Câmera');
      }
    }

    // 2. RNF08 / RF07: Capturar imagem garantindo limites de compressão (máx 1080p)
    const foto = await this.cameraGateway.capturarFoto({
      larguraMaxima: 1080,
      alturaMaxima: 1080,
      qualidade: 0.8,
    });

    // 3. RF-EVI-001: Instanciar Value Object Evidencia com hash e caminho local
    const evidencia = Evidencia.criar({
      id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      caminhoArquivoLocal: foto.uri,
      hash: foto.hash,
      timestamp: new Date(),
    });

    // 4. Se vinculado a um item de checklist da vistoria
    if (input.vistoriaId && input.itemId && this.vistoriaRepo) {
      const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
      if (!vistoria) {
        throw new Error(`Vistoria com ID ${input.vistoriaId} não encontrada`);
      }

      const item = vistoria.itens.find((i) => i.id === input.itemId);
      if (!item) {
        throw new ItemChecklistNaoEncontradoError(input.itemId);
      }

      item.adicionarEvidencia(evidencia);
      await this.vistoriaRepo.salvar(vistoria);
    }

    // 5. Se vinculado a uma ocorrência
    if (input.ocorrenciaId && this.ocorrenciaRepo) {
      const ocorrencia = await this.ocorrenciaRepo.buscarPorId(input.ocorrenciaId);
      if (!ocorrencia) {
        throw new OcorrenciaNaoEncontradaError(input.ocorrenciaId);
      }

      ocorrencia.adicionarFoto(evidencia.caminhoArquivoLocal);
      await this.ocorrenciaRepo.salvar(ocorrencia);
    }

    return evidencia;
  }
}
