import { StatusItemChecklist } from '../../domain/entities/item-checklist.entity';
import { GravidadeOcorrencia } from '../../domain/entities/ocorrencia.entity';
import { StatusVistoria, Vistoria } from '../../domain/entities/vistoria.entity';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';

export interface MetricasHistorico {
  totalVistorias: number;
  vistoriasFinalizadas: number;
  vistoriasEmAndamento: number;
  totalOcorrencias: number;
  ocorrenciasCriticas: number;
  taxaConformidade: number; // % de itens avaliados como OK
  vistorias: Vistoria[];
}

export class ConsultarHistoricoUseCase {
  constructor(
    private readonly vistoriaRepo: IVistoriaRepository,
    private readonly ocorrenciaRepo: IOcorrenciaRepository
  ) {}

  async executar(condominioId: string): Promise<MetricasHistorico> {
    const vistorias = await this.vistoriaRepo.listarPorCondominio(condominioId);
    const todasOcorrencias = await this.ocorrenciaRepo.listarTodas();

    const vistoriasFinalizadas = vistorias.filter((v) => v.status === StatusVistoria.FINALIZADA).length;
    const vistoriasEmAndamento = vistorias.filter(
      (v) => v.status === StatusVistoria.EM_ANDAMENTO || v.status === StatusVistoria.RASCUNHO
    ).length;

    let totalItensAvaliados = 0;
    let totalItensOk = 0;

    for (const vistoria of vistorias) {
      for (const item of vistoria.itens) {
        if (item.status !== StatusItemChecklist.PENDENTE) {
          totalItensAvaliados++;
          if (item.status === StatusItemChecklist.OK) {
            totalItensOk++;
          }
        }
      }
    }

    const taxaConformidade = totalItensAvaliados > 0 ? (totalItensOk / totalItensAvaliados) * 100 : 100;

    const ocorrenciasCriticas = todasOcorrencias.filter(
      (o) => o.gravidade === GravidadeOcorrencia.ALTA
    ).length;

    return {
      totalVistorias: vistorias.length,
      vistoriasFinalizadas,
      vistoriasEmAndamento,
      totalOcorrencias: todasOcorrencias.length,
      ocorrenciasCriticas,
      taxaConformidade: Math.round(taxaConformidade * 10) / 10,
      vistorias,
    };
  }
}
