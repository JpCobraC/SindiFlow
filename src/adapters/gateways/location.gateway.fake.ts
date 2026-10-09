import {
  ILocationGateway,
  LocalizacaoDispositivo,
} from '../../domain/interfaces/location.gateway.interface';

export class LocationGatewayFake implements ILocationGateway {
  private _permissao: boolean = true;
  private _posicao: LocalizacaoDispositivo = {
    latitude: -23.5612,
    longitude: -46.6537,
    precisao: 4.5,
    timestamp: new Date(),
  };

  public setPermissao(valor: boolean): void {
    this._permissao = valor;
  }

  public setPosicao(posicao: Partial<LocalizacaoDispositivo>): void {
    this._posicao = {
      ...this._posicao,
      ...posicao,
      timestamp: posicao.timestamp || new Date(),
    };
  }

  async temPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async solicitarPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async obterPosicaoAtual(): Promise<LocalizacaoDispositivo> {
    return {
      ...this._posicao,
      timestamp: new Date(),
    };
  }
}
