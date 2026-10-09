import { PermissaoNegadaError } from '../../domain/errors/domain-errors';
import { ILocationGateway } from '../../domain/interfaces/location.gateway.interface';
import { IVistoriaRepository } from '../../domain/interfaces/vistoria.repository.interface';
import { Geolocalizacao } from '../../domain/value-objects/geolocalizacao.vo';

export interface CapturarLocalizacaoInput {
  vistoriaId?: string;
}

export class CapturarLocalizacaoUseCase {
  constructor(
    private readonly locationGateway: ILocationGateway,
    private readonly vistoriaRepo?: IVistoriaRepository
  ) {}

  async executar(input?: CapturarLocalizacaoInput): Promise<Geolocalizacao> {
    // 1. RNF02: Verificar e solicitar permissão no primeiro uso
    let temPermissao = await this.locationGateway.temPermissao();
    if (!temPermissao) {
      temPermissao = await this.locationGateway.solicitarPermissao();
      if (!temPermissao) {
        throw new PermissaoNegadaError('GPS / Localização');
      }
    }

    // 2. RNF03: Se vinculado a uma vistoria existente, validar integridade da sessão
    if (input?.vistoriaId && this.vistoriaRepo) {
      const vistoria = await this.vistoriaRepo.buscarPorId(input.vistoriaId);
      if (!vistoria) {
        throw new Error(`Vistoria com ID ${input.vistoriaId} não encontrada`);
      }
    }

    // 3. Captura posição através do Gateway desacoplado
    const posicao = await this.locationGateway.obterPosicaoAtual();

    // 4. Instancia Value Object imutável com regras de validação (-90..90, -180..180)
    return Geolocalizacao.criar({
      latitude: posicao.latitude,
      longitude: posicao.longitude,
      precisao: posicao.precisao,
      timestamp: posicao.timestamp,
    });
  }
}
