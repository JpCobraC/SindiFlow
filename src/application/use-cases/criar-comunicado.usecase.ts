import { Comunicado } from '../../domain/entities/comunicado.entity';
import { IComunicadoRepository } from '../../domain/interfaces/comunicado.repository.interface';
import { IOutboxRepository } from '../../domain/interfaces/outbox.repository.interface';

export interface CriarComunicadoInput {
  id: string;
  condominioId: string;
  autorId: string;
  autorNome: string;
  titulo: string;
  conteudo: string;
  fixado?: boolean;
  deviceId: string;
}

export class CriarComunicadoUseCase {
  constructor(
    private readonly comunicadoRepo: IComunicadoRepository,
    private readonly outboxRepo?: IOutboxRepository
  ) {}

  async executar(input: CriarComunicadoInput): Promise<Comunicado> {
    const comunicado = new Comunicado({
      id: input.id,
      condominioId: input.condominioId,
      autorId: input.autorId,
      autorNome: input.autorNome,
      titulo: input.titulo,
      conteudo: input.conteudo,
      fixado: input.fixado ?? false,
    });

    await this.comunicadoRepo.salvar(comunicado);

    if (this.outboxRepo) {
      await this.outboxRepo.enfileirar({
        tabela: 'comunicados',
        operacao: 'INSERT',
        idRegistro: comunicado.id,
        payload: {
          id: comunicado.id,
          condominio_id: comunicado.condominioId,
          autor_id: comunicado.autorId,
          autor_nome: comunicado.autorNome,
          titulo: comunicado.titulo,
          conteudo: comunicado.conteudo,
          fixado: comunicado.fixado,
          data_criacao: comunicado.dataCriacao.toISOString(),
        },
        usuarioId: input.autorId,
        deviceId: input.deviceId,
      });
    }

    return comunicado;
  }
}
