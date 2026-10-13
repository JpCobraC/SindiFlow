import { EstadoRede, INetworkService } from '../../domain/interfaces/network.service.interface';

export class NetworkServiceFake implements INetworkService {
  private _estado: EstadoRede;

  constructor(initialOnline: boolean = false) {
    this._estado = initialOnline ? EstadoRede.ONLINE : EstadoRede.OFFLINE;
  }

  async estadoConexao(): Promise<EstadoRede> {
    return this._estado;
  }

  async estaConectado(): Promise<boolean> {
    return this._estado === EstadoRede.ONLINE;
  }

  setOnline(status: boolean): void {
    this._estado = status ? EstadoRede.ONLINE : EstadoRede.OFFLINE;
  }

  /** Simula o "conectado mas sem rota confirmada" que o `expo-network` reporta. */
  setIndeterminado(): void {
    this._estado = EstadoRede.INDETERMINADO;
  }

  isOnline(): boolean {
    return this._estado === EstadoRede.ONLINE;
  }
}
