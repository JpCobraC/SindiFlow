import {
  ItemChecklist,
  StatusItemChecklist,
} from '../../domain/entities/item-checklist.entity';
import { Vistoria, StatusVistoria } from '../../domain/entities/vistoria.entity';
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

export class VistoriaRepositorySQLite implements IVistoriaRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(vistoria: Vistoria): Promise<void> {
    const agora = new Date().toISOString();

    await this.executor.emTransacao(async (tx) => {
      // RF-SYNC-005: last-write-wins por updated_at. Só atualiza se o registro
      // existente tiver updated_at menor que o novo (ou não existir).
      const existente = await tx.consultarUm<{ updated_at: string }>(
        'SELECT updated_at FROM vistorias WHERE id = ?',
        [vistoria.id]
      );

      if (existente && existente.updated_at >= agora) {
        // Registro existente é mais recente ou igual: não sobrescreve.
        return;
      }

      await tx.executar(
        `INSERT INTO vistorias (
          id, condominio_id, inspetor_id, status, latitude, longitude, precisao,
          data_criacao, data_finalizacao, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          condominio_id = excluded.condominio_id,
          inspetor_id = excluded.inspetor_id,
          status = excluded.status,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          precisao = excluded.precisao,
          data_criacao = excluded.data_criacao,
          data_finalizacao = excluded.data_finalizacao,
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
          agora,
        ]
      );

      // O checklist é parte do agregado, mas mora em tabela própria. Antes
      // desta gravação o repositório descartava os itens em silêncio: a
      // vistoria voltava do banco sem checklist e `marcarItem` falhava com
      // "item não encontrado" logo após o primeiro cold start.
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
            agora,
          ]
        );
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

    return linhas.map((linha) =>
      ItemChecklist.criar({
        id: linha.id,
        vistoriaId: linha.vistoria_id,
        titulo: linha.titulo,
        categoria: linha.categoria,
        status: linha.status,
        observacao: linha.observacao ?? undefined,
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

    // reidratar (não criar): permite status FINALIZADA vindo do banco sem
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
    });
  }
}
