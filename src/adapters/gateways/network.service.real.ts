/**
 * SindiFlow — NetworkServiceReal
 * Camada: Adapters (Gateways)
 *
 * Implementação real de `INetworkService` usando `expo-network`.
 *
 * Conformidade com §1.3: detecção de rede obrigatória antes de toda tentativa
 * de sync. Usa tri-estado (ONLINE / OFFLINE / INDETERMINADO) para não mentir
 * quando `isInternetReachable` é `null`.
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 */

import * as Network from 'expo-network';
import { EstadoRede, INetworkService } from '../../domain/interfaces/network.service.interface';

export class NetworkServiceReal implements INetworkService {
  /**
   * Retorna o estado atual da conexão.
   *
   * `expo-network` devolve `isInternetReachable: boolean | null`:
   * - `true`  → ONLINE
   * - `false` → OFFLINE
   * - `null`  → INDETERMINADO (não se sabe ainda; trata como OFFLINE no sync)
   */
  async estadoConexao(): Promise<EstadoRede> {
    const { isInternetReachable } = await Network.getNetworkStateAsync();

    if (isInternetReachable === true) {
      return EstadoRede.ONLINE;
    }
    return EstadoRede.OFFLINE;
  }

  /**
   * Retorna `true` apenas quando a rede está ONLINE.
   *
   * Usado pelo `SincronizarOutboxUseCase` como gate explícito de §1.3
   * antes de toda tentativa de sincronização. INDETERMINADO e OFFLINE
   * ambos retornam `false`.
   */
  async estaConectado(): Promise<boolean> {
    const estado = await this.estadoConexao();
    return estado === EstadoRede.ONLINE;
  }
}
