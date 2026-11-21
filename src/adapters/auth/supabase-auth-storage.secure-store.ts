/**
 * SindiFlow — SupabaseAuthStorage
 * Camada: Adapters (Auth)
 *
 * Adapter de `SupportedStorage` para o cliente Supabase. O SDK guarda a sessão
 * (access token + refresh token + metadata do usuário) no Keychain/Keystore via
 * `expo-secure-store`.
 *
 * O valor de uma sessão Supabase costuma passar de 2 KB. O Keychain do iOS pode
 * recusar valores nesse tamanho, então o payload é dividido em chunks de 480
 * code points (no máximo ~1920 bytes em UTF-8) e um manifesto guarda a
 * contagem. Valores gravados pelo formato antigo — um único item — continuam
 * legíveis e são removidos na próxima gravação.
 *
 * Conformidade com §1.2: sessão em `expo-secure-store`, nunca `AsyncStorage`.
 * Conformidade com §1.1: 100% nativo, sem cookies/localStorage de browser.
 */

import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

const PREFIXO = 'sindiflow.supabase.auth.';
const PREFIXO_META = `${PREFIXO}meta.`;
const PREFIXO_CHUNK = `${PREFIXO}chunk.`;

/** 480 code points cabem em ~1920 bytes mesmo com caracteres de 4 bytes. */
const TAMANHO_CHUNK = 480;
const MAX_CHUNKS = 64;

export class SupabaseAuthStorage implements SupportedStorage {
  async getItem(chave: string): Promise<string | null> {
    const total = await this.lerTotalDeChunks(chave);

    if (total !== null) {
      const partes = await Promise.all(
        Array.from({ length: total }, (_, indice) =>
          SecureStore.getItemAsync(this.nomeChunk(chave, indice))
        )
      );

      // Um chunk ausente significa sessão corrompida. Devolver `null` faz o
      // Supabase tratar como "sem sessão" em vez de montar um JSON inválido.
      if (partes.some((parte) => parte === null)) {
        return null;
      }

      return partes.join('');
    }

    return SecureStore.getItemAsync(`${PREFIXO}${chave}`);
  }

  async setItem(chave: string, valor: string): Promise<void> {
    const partes = this.dividir(valor);
    const totalAnterior = await this.lerTotalDeChunks(chave);

    await Promise.all(
      partes.map((parte, indice) =>
        SecureStore.setItemAsync(this.nomeChunk(chave, indice), parte)
      )
    );

    // O manifesto é gravado por último: se uma gravação falhar no meio, a
    // leitura antiga continua consistente.
    await SecureStore.setItemAsync(this.nomeMeta(chave), String(partes.length));

    if (totalAnterior !== null && totalAnterior > partes.length) {
      await Promise.all(
        Array.from({ length: totalAnterior - partes.length }, (_, offset) =>
          SecureStore.deleteItemAsync(
            this.nomeChunk(chave, partes.length + offset)
          )
        )
      );
    }

    // Migração: remove o valor único gravado por versões anteriores.
    await SecureStore.deleteItemAsync(`${PREFIXO}${chave}`);
  }

  async removeItem(chave: string): Promise<void> {
    const total = await this.lerTotalDeChunks(chave);
    const remocoes: Promise<void>[] = [
      SecureStore.deleteItemAsync(`${PREFIXO}${chave}`),
      SecureStore.deleteItemAsync(this.nomeMeta(chave)),
    ];

    if (total !== null) {
      for (let indice = 0; indice < total; indice++) {
        remocoes.push(
          SecureStore.deleteItemAsync(this.nomeChunk(chave, indice))
        );
      }
    }

    await Promise.all(remocoes);
  }

  private dividir(valor: string): string[] {
    const codePoints = Array.from(valor);
    const total = Math.ceil(codePoints.length / TAMANHO_CHUNK);

    if (total > MAX_CHUNKS) {
      throw new Error(
        `Sessão excede o limite de segurança do SecureStore ` +
          `(${MAX_CHUNKS * TAMANHO_CHUNK} caracteres).`
      );
    }

    return Array.from({ length: total }, (_, indice) =>
      codePoints
        .slice(indice * TAMANHO_CHUNK, (indice + 1) * TAMANHO_CHUNK)
        .join('')
    );
  }

  private async lerTotalDeChunks(chave: string): Promise<number | null> {
    const bruto = await SecureStore.getItemAsync(this.nomeMeta(chave));
    if (bruto === null) return null;

    const total = Number(bruto);
    if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS) {
      return null;
    }

    return total;
  }

  private nomeMeta(chave: string): string {
    return `${PREFIXO_META}${chave}`;
  }

  private nomeChunk(chave: string, indice: number): string {
    return `${PREFIXO_CHUNK}${chave}.${indice}`;
  }
}
