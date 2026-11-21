/**
 * SindiFlow — DeviceIdSecureStore
 * Camada: Adapters (Auth)
 *
 * Identificador estável do dispositivo, gerado uma vez e guardado no
 * SecureStore. Substitui o literal `expo-device-01` que ia em toda outbox e
 * fazia todos os aparelhos se apresentarem como o mesmo dispositivo.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const CHAVE = 'sindiflow.device_id';

export class DeviceIdSecureStore {
  private cache: string | null = null;

  async obter(): Promise<string> {
    if (this.cache) return this.cache;

    const existente = await SecureStore.getItemAsync(CHAVE);
    if (existente) {
      this.cache = existente;
      return existente;
    }

    const novo = `dev-${Crypto.randomUUID()}`;
    await SecureStore.setItemAsync(CHAVE, novo);
    this.cache = novo;
    return novo;
  }
}
