import { Ocorrencia, GravidadeOcorrencia, StatusOcorrencia } from '../../domain/entities/ocorrencia.entity';
import { IOcorrenciaRepository } from '../../domain/interfaces/ocorrencia.repository.interface';
import { ISQLiteExecutor } from './sqlite-executor.interface';

function iso(date?: Date): string | null {
  return date ? date.toISOString() : null;
}

export type LinhaOcorrencia = {
  id: string;
  vistoria_id: string;
  item_id: string | null;
  titulo: string;
  descricao: string | null;
  gravidade: GravidadeOcorrencia;
  status: StatusOcorrencia;
  sla_horas: number;
  data_limite_sla: string;
  data_criacao: string;
  data_resolucao: string | null;
  data_cancelamento: string | null;
  solucao: string | null;
  updated_at: string;
};

export class OcorrenciaRepositorySQLite implements IOcorrenciaRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(ocorrencia: Ocorrencia): Promise<void> {
    await this.executor.emTransacao(async (tx) => {
      await tx.executar(
        `INSERT INTO ocorrencias (
          id, vistoria_id, item_id, titulo, descricao, gravidade, status,
          sla_horas, data_limite_sla, data_criacao, data_resolucao,
          data_cancelamento, solucao, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          vistoria_id = excluded.vistoria_id,
          item_id = excluded.item_id,
          titulo = excluded.titulo,
          descricao = excluded.descricao,
          gravidade = excluded.gravidade,
          status = excluded.status,
          sla_horas = excluded.sla_horas,
          data_limite_sla = excluded.data_limite_sla,
          data_criacao = excluded.data_criacao,
          data_resolucao = excluded.data_resolucao,
          data_cancelamento = excluded.data_cancelamento,
          solucao = excluded.solucao,
          updated_at = excluded.updated_at`,
        [
          ocorrencia.id,
          ocorrencia.vistoriaId,
          ocorrencia.itemId ?? null,
          ocorrencia.titulo,
          ocorrencia.descricao ?? null,
          ocorrencia.gravidade,
          ocorrencia.status,
          ocorrencia.slaHoras,
          ocorrencia.dataLimiteSla.toISOString(),
          ocorrencia.dataCriacao.toISOString(),
          iso(ocorrencia.dataResolucao),
          iso(ocorrencia.dataCancelamento),
          ocorrencia.solucao ?? null,
          new Date().toISOString(),
        ]
      );
    });
  }

  async buscarPorId(id: string): Promise<Ocorrencia | null> {
    const linha = await this.executor.consultarUm<LinhaOcorrencia>(
      'SELECT * FROM ocorrencias WHERE id = ?',
      [id]
    );

    if (!linha) return null;

    return this.hidratar(linha);
  }

  async listarPorVistoria(vistoriaId: string): Promise<Ocorrencia[]> {
    const linhas = await this.executor.consultar<LinhaOcorrencia>(
      'SELECT * FROM ocorrencias WHERE vistoria_id = ?',
      [vistoriaId]
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  async listarTodas(): Promise<Ocorrencia[]> {
    const linhas = await this.executor.consultar<LinhaOcorrencia>(
      'SELECT * FROM ocorrencias'
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  private hidratar(linha: LinhaOcorrencia): Ocorrencia {
    // reidratar (não criar): não revalida regras de negócio (ALTA sem foto etc.)
    // — os dados já foram validados quando gravados.
    return Ocorrencia.reidratar({
      id: linha.id,
      vistoriaId: linha.vistoria_id,
      itemId: linha.item_id ?? undefined,
      titulo: linha.titulo,
      descricao: linha.descricao ?? undefined,
      gravidade: linha.gravidade,
      status: linha.status,
      fotos: [], // fotos carregadas separadamente (tabela fotos_evidencia)
      dataCriacao: new Date(linha.data_criacao),
      dataResolucao: linha.data_resolucao ? new Date(linha.data_resolucao) : undefined,
      solucao: linha.solucao ?? undefined,
    });
  }
}
