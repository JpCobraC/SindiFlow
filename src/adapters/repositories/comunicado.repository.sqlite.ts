import { Comunicado } from '../../domain/entities/comunicado.entity';
import { IComunicadoRepository } from '../../domain/interfaces/comunicado.repository.interface';
import { ISQLiteExecutor } from './sqlite-executor.interface';

function iso(date: Date): string {
  return date.toISOString();
}

export type LinhaComunicado = {
  id: string;
  condominio_id: string;
  autor_id: string;
  autor_nome: string;
  titulo: string;
  conteudo: string;
  data_criacao: string;
  fixado: number;
  updated_at: string;
};

export class ComunicadoRepositorySQLite implements IComunicadoRepository {
  constructor(private readonly executor: ISQLiteExecutor) {}

  async salvar(comunicado: Comunicado): Promise<void> {
    const agora = new Date().toISOString();
    await this.executor.emTransacao(async (tx) => {
      await tx.executar(
        `INSERT INTO comunicados (
          id, condominio_id, autor_id, autor_nome, titulo, conteudo,
          data_criacao, fixado, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          condominio_id = excluded.condominio_id,
          autor_id = excluded.autor_id,
          autor_nome = excluded.autor_nome,
          titulo = excluded.titulo,
          conteudo = excluded.conteudo,
          fixado = excluded.fixado,
          updated_at = excluded.updated_at`,
        [
          comunicado.id,
          comunicado.condominioId,
          comunicado.autorId,
          comunicado.autorNome,
          comunicado.titulo,
          comunicado.conteudo,
          iso(comunicado.dataCriacao),
          comunicado.fixado ? 1 : 0,
          agora,
        ]
      );
    });
  }

  async buscarPorId(id: string): Promise<Comunicado | null> {
    const linha = await this.executor.consultarUm<LinhaComunicado>(
      'SELECT * FROM comunicados WHERE id = ?',
      [id]
    );
    if (!linha) return null;
    return this.hidratar(linha);
  }

  async listarPorCondominio(condominioId: string): Promise<Comunicado[]> {
    const linhas = await this.executor.consultar<LinhaComunicado>(
      'SELECT * FROM comunicados WHERE condominio_id = ? ORDER BY data_criacao DESC',
      [condominioId]
    );
    return linhas.map((l) => this.hidratar(l));
  }

  private hidratar(linha: LinhaComunicado): Comunicado {
    return new Comunicado({
      id: linha.id,
      condominioId: linha.condominio_id,
      autorId: linha.autor_id,
      autorNome: linha.autor_nome,
      titulo: linha.titulo,
      conteudo: linha.conteudo,
      dataCriacao: new Date(linha.data_criacao),
      fixado: linha.fixado === 1,
    });
  }
}
