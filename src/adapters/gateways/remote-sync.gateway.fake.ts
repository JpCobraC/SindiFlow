import { ItemOutbox } from '../../domain/interfaces/outbox.repository.interface';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export class RemoteSyncGatewayFake implements IRemoteSyncGateway {
  private _simularErro503: boolean = false;
  public itensSincronizados: ItemOutbox[] = [];

  setSimularErro503(valor: boolean): void {
    this._simularErro503 = valor;
  }

  isSimulandoErro503(): boolean {
    return this._simularErro503;
  }

  async sincronizarItem(item: ItemOutbox): Promise<boolean> {
    if (this._simularErro503) {
      throw new Error('HTTP 503 Service Unavailable: Nuvem temporariamente instável');
    }
    this.itensSincronizados.push(item);
    return true;
  }
}
