import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { ErroSincronizacao } from '../../domain/errors/domain-errors';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export class RemoteSyncGatewayFake implements IRemoteSyncGateway {
  private _simularErro503 = false;
  private _simularErro403 = false;
  public itensSincronizados: OutboxEvent[] = [];

  setSimularErro503(valor: boolean): void {
    this._simularErro503 = valor;
  }

  /** 4xx: falha permanente, entra em dead-letter na hora (C-05). */
  setSimularErro403(valor: boolean): void {
    this._simularErro403 = valor;
  }

  isSimulandoErro503(): boolean {
    return this._simularErro503;
  }

  async sincronizarItem(evento: OutboxEvent): Promise<void> {
    if (this._simularErro403) {
      throw new ErroSincronizacao('HTTP 403: usuário revogado no condomínio', false, 403);
    }
    if (this._simularErro503) {
      throw new ErroSincronizacao('HTTP 503: nuvem temporariamente instável', true, 503);
    }
    this.itensSincronizados.push(evento);
  }
}
