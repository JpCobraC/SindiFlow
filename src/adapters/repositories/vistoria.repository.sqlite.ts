import {
  ItemChecklist,
  StatusItemChecklist,
} from '../../domain/entities/item-checklist.entity';
import { Vistoria, StatusVistoria } from '../../domain/entities/vistoria.entity';
import { Evidencia } from '../../domain/value-objects/evidencia.vo';
import { Geolocalizacao } from '../../domain/value-objects/geolocalizacao.vo';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { ISQLiteExecutor } from './sqlite-executor.interface';

function iso(date?: Date): string | null {
  return date ? date.toISOString() : null;
}

export type LinhaVistoria = {
  id: string;
  condominio_id: string;
  inspetor_id: string;
  status: StatusVistoria;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  data_criacao: string;
  data_finalizacao: string | null;
  parecer_tecnico: string | null;
  motivo_devolucao: string | null;
  devolvido_por: string | null;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  updated_at: string;
};

export type LinhaItemChecklist = {
  id: string;
  vistoria_id: string;
  titulo: string;
  categoria: string;
  status: StatusItemChecklist;
  observacao: string | null;
  updated_at: string;
};

type LinhaFotoEvidenciaItem = {
  id: string;
  item_id: string | null;
  ocorrencia_id: string | null;
  caminho_arquivo: string;
  hash: string;
  tamanho_bytes: number | null;
  data_captura: string;
  updated_at: string;
};

export class VistoriaRepositorySQLite implements IVistoriaRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(vistoria: Vistoria): Promise<void> {
    const agora = new Date().toISOString();

    await this.executor.emTransacao(async (tx) => {
      // Garante monotonicidade de updated_at para que duas gravações no mesmo
      // milissegundo (ex.: finalizar e aprovar em sequência) nunca sejam descartadas.
      const existente = await tx.consultarUm<{ updated_at: string }>(
        'SELECT updated_at FROM vistorias WHERE id = ?',
        [vistoria.id]
      );

      const timestampSalvar =
        existente && existente.updated_at >= agora
          ? new Date(Date.parse(existente.updated_at) + 1).toISOString()
          : agora;

      await tx.executar(
        `INSERT INTO vistorias (
          id, condominio_id, inspetor_id, status, latitude, longitude, precisao,
          data_criacao, data_finalizacao, parecer_tecnico, motivo_devolucao,
          devolvido_por, aprovado_por, data_aprovacao, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          condominio_id = excluded.condominio_id,
          inspetor_id = excluded.inspetor_id,
          status = excluded.status,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          precisao = excluded.precisao,
          data_criacao = excluded.data_criacao,
          data_finalizacao = excluded.data_finalizacao,
          parecer_tecnico = excluded.parecer_tecnico,
          motivo_devolucao = excluded.motivo_devolucao,
          devolvido_por = excluded.devolvido_por,
          aprovado_por = excluded.aprovado_por,
          data_aprovacao = excluded.data_aprovacao,
          updated_at = excluded.updated_at`,
        [
          vistoria.id,
          vistoria.condominioId,
          vistoria.inspetorId,
          vistoria.status,
          vistoria.geolocalizacao?.latitude ?? null,
          vistoria.geolocalizacao?.longitude ?? null,
          vistoria.geolocalizacao?.precisao ?? null,
          vistoria.dataCriacao.toISOString(),
          iso(vistoria.dataFinalizacao),
          vistoria.parecerTecnico ?? null,
          vistoria.motivoDevolucao ?? null,
          vistoria.devolvidoPor ?? null,
          vistoria.aprovadoPor ?? null,
          iso(vistoria.dataAprovacao),
          timestampSalvar,
        ]
      );

      for (const item of vistoria.itens) {
        await tx.executar(
          `INSERT INTO itens_checklist (
            id, vistoria_id, titulo, categoria, status, observacao, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            vistoria_id = excluded.vistoria_id,
            titulo = excluded.titulo,
            categoria = excluded.categoria,
            status = excluded.status,
            observacao = excluded.observacao,
            updated_at = excluded.updated_at`,
          [
            item.id,
            vistoria.id,
            item.titulo,
            item.categoria,
            item.status,
            item.observacao ?? null,
            timestampSalvar,
          ]
        );

        for (const evidencia of item.evidencias) {
          await tx.executar(
            `INSERT INTO fotos_evidencia (
              id, item_id, ocorrencia_id, caminho_arquivo, hash,
              tamanho_bytes, data_captura, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              item_id = excluded.item_id,
              caminho_arquivo = excluded.caminho_arquivo,
              hash = excluded.hash,
              data_captura = excluded.data_captura,
              updated_at = excluded.updated_at`,
            [
              evidencia.id,
              item.id,
              null,
              evidencia.caminhoArquivoLocal,
              evidencia.hash,
              null,
              evidencia.timestamp.toISOString(),
              timestampSalvar,
            ]
          );
        }
      }
    });
  }

  async buscarPorId(id: string): Promise<Vistoria | null> {
    const linha = await this.executor.consultarUm<LinhaVistoria>(
      'SELECT * FROM vistorias WHERE id = ?',
      [id]
    );

    if (!linha) return null;

    const itens = await this.carregarItens(linha.id);
    return this.hidratar(linha, itens);
  }

  async listarPorCondominio(condominioId: string): Promise<Vistoria[]> {
    const linhas = await this.executor.consultar<LinhaVistoria>(
      'SELECT * FROM vistorias WHERE condominio_id = ?',
      [condominioId]
    );

    return Promise.all(
      linhas.map(async (linha) =>
        this.hidratar(linha, await this.carregarItens(linha.id))
      )
    );
  }

  private async carregarItens(vistoriaId: string): Promise<ItemChecklist[]> {
    const linhas = await this.executor.consultar<LinhaItemChecklist>(
      'SELECT * FROM itens_checklist WHERE vistoria_id = ? ORDER BY rowid ASC',
      [vistoriaId]
    );

    return Promise.all(
      linhas.map(async (linha) => {
        const fotosLinhas = await this.executor.consultar<LinhaFotoEvidenciaItem>(
          'SELECT * FROM fotos_evidencia WHERE item_id = ?',
          [linha.id]
        );

        const evidencias = fotosLinhas.map((f) =>
          Evidencia.criar({
            id: f.id,
            caminhoArquivoLocal: f.caminho_arquivo,
            hash: f.hash,
            timestamp: new Date(f.data_captura),
          })
        );

        return ItemChecklist.criar({
          id: linha.id,
          vistoriaId: linha.vistoria_id,
          titulo: linha.titulo,
          categoria: linha.categoria,
          status: linha.status,
          observacao: linha.observacao ?? undefined,
          evidencias,
        });
      })
    );
  }

  private hidratar(linha: LinhaVistoria, itens: ItemChecklist[]): Vistoria {
    const geo =
      linha.latitude !== null && linha.longitude !== null
        ? Geolocalizacao.criar({
            latitude: linha.latitude,
            longitude: linha.longitude,
            precisao: linha.precisao ?? undefined,
          })
        : undefined;

    // reidratar (não criar): permite status FINALIZADA/APROVADA vindo do banco sem
    // disparar a guarda de RF-VIST-001 (só a criação recusa status != RASCUNHO).
    return Vistoria.reidratar({
      id: linha.id,
      condominioId: linha.condominio_id,
      inspetorId: linha.inspetor_id,
      status: linha.status,
      dataCriacao: new Date(linha.data_criacao),
      dataFinalizacao: linha.data_finalizacao ? new Date(linha.data_finalizacao) : undefined,
      geolocalizacao: geo,
      itens,
      parecerTecnico: linha.parecer_tecnico ?? undefined,
      motivoDevolucao: linha.motivo_devolucao ?? undefined,
      devolvidoPor: linha.devolvido_por ?? undefined,
      aprovadoPor: linha.aprovado_por ?? undefined,
      dataAprovacao: linha.data_aprovacao ? new Date(linha.data_aprovacao) : undefined,
    });
  }
}
