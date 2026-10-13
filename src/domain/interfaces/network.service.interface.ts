/**
 * Estado da conexão como tri-estado.
 *
 * `expo-network` devolve `isInternetReachable: boolean | null`, e `null` significa
 * *"indeterminado"*, não `false`. Com `Promise<boolean>` o adapter teria de mentir
 * em uma das duas direções: `null → false` trava o sync para sempre; `null → true`
 * tenta sincronizar sem rota. Tri-estado elimina a mentira.
 */
export enum EstadoRede {
  /** Sem interface de rede. */
  OFFLINE = 'OFFLINE',
  /** Conectado, mas o alcance da internet ainda não foi determinado. */
  INDETERMINADO = 'INDETERMINADO',
  /** Conectado e com internet comprovadamente acessível. */
  ONLINE = 'ONLINE',
}

export interface INetworkService {
  /**
   * Estado atual. Para sincronização, trate `INDETERMINADO` como offline: uma
   * tentativa de envio sem rota só produz erro e queima uma tentativa do retry.
   */
  estadoConexao(): Promise<EstadoRede>;

  /** Só `ONLINE`. Mantido para o gate explícito de §1.3 antes de todo sync. */
  estaConectado(): Promise<boolean>;
}
