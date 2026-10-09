import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
} from '../../domain/interfaces/camera.gateway.interface';

export class CameraGatewayFake implements ICameraGateway {
  private _permissao: boolean = true;
  private _fotoRetorno?: Partial<FotoCapturada>;

  public setPermissao(valor: boolean): void {
    this._permissao = valor;
  }

  public setFotoRetorno(foto: Partial<FotoCapturada>): void {
    this._fotoRetorno = foto;
  }

  async temPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async solicitarPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async capturarFoto(options?: CapturaFotoOptions): Promise<FotoCapturada> {
    const timestamp = Date.now();
    const largura = options?.larguraMaxima ? Math.min(options.larguraMaxima, 1080) : 1080;
    const altura = options?.alturaMaxima ? Math.min(options.alturaMaxima, 1080) : 1080;

    return {
      uri: this._fotoRetorno?.uri || `file:///cache/evidencia_${timestamp}.jpg`,
      largura: this._fotoRetorno?.largura || largura,
      altura: this._fotoRetorno?.altura || altura,
      tamanhoBytes: this._fotoRetorno?.tamanhoBytes || 450000,
      hash: this._fotoRetorno?.hash || `sha256_${timestamp}_mock`,
    };
  }
}
