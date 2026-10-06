import { INetworkService } from '../../domain/interfaces/network.service.interface';

export class NetworkServiceFake implements INetworkService {
  private _online: boolean = false;

  constructor(initialOnline: boolean = false) {
    this._online = initialOnline;
  }

  async estaConectado(): Promise<boolean> {
    return this._online;
  }

  setOnline(status: boolean): void {
    this._online = status;
  }

  isOnline(): boolean {
    return this._online;
  }
}
