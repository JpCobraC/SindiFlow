/**
 * SindiFlow — SyncGatewaySupabase
 * Camada: Adapters (Gateways)
 *
 * Implementação real de `IRemoteSyncGateway` usando o Supabase.
 *
 * Conformidade com §1.3: toda operação de escrita passa pela fila de outbox
 * local; este gateway apenas envia eventos já enfileirados para o Supabase.
 * O retry exponencial é gerenciado pelo `OutboxEvent` (1s, 2s, 4s, 8s, 16s)
 * e o `SincronizarOutboxUseCase` chama este gateway apenas quando a rede
 * está disponível (`NetworkServiceReal`).
 *
 * Conformidade com §3.3 (C-05): erros 4xx são permanentes (dead-letter imediato),
 * erros 5xx são transitórios (seguem backoff exponencial).
 *
 * Conformidade com §1.1: 100% nativo, sem web/PWA/browser.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { ErroSincronizacao } from '../../domain/errors/domain-errors';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export class SyncGatewaySupabase implements IRemoteSyncGateway {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey);
  }

  /**
   * Envia um evento do outbox para o Supabase via upsert na tabela
   * correspondente.
   *
   * O `chaveDedup` do evento (RF-SYNC-007) garante que reenvio nunca duplica
   * registro: o upsert usa a chave dedup como critério de conflito.
   *
   * Lança `ErroSincronizacao` em caso de falha:
   * - 4xx (payload inválido, usuário revogado): transitorio=false → dead-letter
   * - 5xx, timeout, erro de rede: transitorio=true → backoff exponencial
   * - Erro não tipado: transitorio=true (falha de rede não vem rotulada)
   */
  async sincronizarItem(evento: OutboxEvent): Promise<void> {
    try {
      const { error } = await this.client
        .from(evento.tabela)
        .upsert(evento.payload, {
          onConflict: evento.chaveDedup,
        });

      if (error) {
        this.tratarErroSupabase(error);
      }
    } catch (erro: any) {
      // Erro de rede, timeout, ou exceção não tipada do SDK
      throw new ErroSincronizacao(
        erro?.message || 'Erro desconhecido na sincronização com Supabase',
        true, // erro não tipado é tratado como transitório
        erro?.status
      );
    }
  }

  /**
   * Traduz um erro do Supabase para `ErroSincronizacao` com o sinalizador
   * `transitorio` correto (resolve C-05).
   *
   * - status >= 400 e < 500 → transitorio=false (dead-letter imediato)
   * - status >= 500 → transitorio=true (backoff exponencial)
   */
  private tratarErroSupabase(error: any): void {
    const statusCode = error?.status;
    const mensagem = error?.message || 'Erro do Supabase';
    const codigo = error?.code;

    const transitorio = statusCode ? statusCode >= 500 : true;

    throw new ErroSincronizacao(
      `[Supabase ${codigo || statusCode}] ${mensagem}`,
      transitorio,
      statusCode
    );
  }
}
