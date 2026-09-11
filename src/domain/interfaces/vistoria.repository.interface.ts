import { Vistoria } from '../entities/vistoria.entity';

export interface IVistoriaRepository {
  salvar(vistoria: Vistoria): Promise<void>;
  buscarPorId(id: string): Promise<Vistoria | null>;
  listarPorCondominio(condominioId: string): Promise<Vistoria[]>;
}
