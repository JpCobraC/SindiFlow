import {
  CapturaFotoOptions,
  FotoCapturada,
  ICameraGateway,
  ResultadoCaptura,
} from '../../domain/interfaces/camera.gateway.interface';

export class CameraGatewayFake implements ICameraGateway {
  private _permissao = true;
  private _fotoRetorno?: Partial<FotoCapturada>;
  private _cancelado = false;
  private _erro?: string;

  public setPermissao(valor: boolean): void {
    this._permissao = valor;
  }

  public setFotoRetorno(foto: Partial<FotoCapturada>): void {
    this._fotoRetorno = foto;
  }

  /** Simula o usuário fechando a câmera — o caminho mais comum na prática. */
  public setCancelado(valor: boolean): void {
    this._cancelado = valor;
  }

  /** Simula falha de hardware da câmera. */
  public setErro(mensagem: string): void {
    this._erro = mensagem;
  }

  async temPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async solicitarPermissao(): Promise<boolean> {
    return this._permissao;
  }

  async capturarFoto(options?: CapturaFotoOptions): Promise<ResultadoCaptura> {
    if (this._erro) {
      return { status: 'erro', mensagem: this._erro };
    }
    if (this._cancelado) {
      return { status: 'cancelado' };
    }

    const timestamp = Date.now();
    const largura = options?.larguraMaxima ? Math.min(options.larguraMaxima, 1080) : 1080;
    const altura = options?.alturaMaxima ? Math.min(options.alturaMaxima, 1080) : 1080;

    return {
      status: 'sucesso',
      foto: {
        uri: this._fotoRetorno?.uri || `file:///cache/evidencia_${timestamp}.jpg`,
        largura: this._fotoRetorno?.largura || largura,
        altura: this._fotoRetorno?.altura || altura,
        tamanhoBytes: this._fotoRetorno?.tamanhoBytes || 450_000,
        hash: this._fotoRetorno?.hash || `sha256_${timestamp}_mock`,
        timestamp: this._fotoRetorno?.timestamp || new Date(timestamp),
      },
    };
  }
}
