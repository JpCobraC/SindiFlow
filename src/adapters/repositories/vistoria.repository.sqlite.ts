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

export class VistoriaRepositorySQLite implements IVistoriaRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(vistoria: Vistoria): Promise<void> {
    await this.executor.emTransacao(async (tx) => {
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
          new Date().toISOString(),
        ]
      );
    });
  }

  async buscarPorId(id: string): Promise<Vistoria | null> {
    const linha = await this.executor.consultarUm<LinhaVistoria>(
      'SELECT * FROM vistorias WHERE id = ?',
      [id]
    );

    if (!linha) return null;

    return this.hidratar(linha);
  }

  async listarPorCondominio(condominioId: string): Promise<Vistoria[]> {
    const linhas = await this.executor.consultar<LinhaVistoria>(
      'SELECT * FROM vistorias WHERE condominio_id = ?',
      [condominioId]
    );

    return linhas.map((linha) => this.hidratar(linha));
  }

  private hidratar(linha: LinhaVistoria): Vistoria {
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
      itens: [], // itens carregados separadamente (tabela itens_checklist)
    });
  }
}
