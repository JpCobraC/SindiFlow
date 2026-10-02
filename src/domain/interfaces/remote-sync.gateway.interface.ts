import { ItemOutbox } from './outbox.repository.interface';

export interface IRemoteSyncGateway {
  sincronizarItem(item: ItemOutbox): Promise<boolean>;
}
