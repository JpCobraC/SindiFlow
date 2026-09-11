export interface INetworkService {
  estaConectado(): Promise<boolean>;
}
