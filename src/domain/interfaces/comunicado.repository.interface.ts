import { Comunicado } from '../entities/comunicado.entity';

export interface IComunicadoRepository {
  salvar(comunicado: Comunicado): Promise<void>;
  buscarPorId(id: string): Promise<Comunicado | null>;
  listarPorCondominio(condominioId: string): Promise<Comunicado[]>;
}
