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
import { SupabaseClient } from '@supabase/supabase-js';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { ErroSincronizacao } from '../../domain/errors/domain-errors';
import { AuthGateway } from '../../domain/interfaces/auth.gateway.interface';
import { IRemoteSyncGateway } from '../../domain/interfaces/remote-sync.gateway.interface';

export class SyncGatewaySupabase implements IRemoteSyncGateway {
  /**
   * Recebe o mesmo cliente autenticado do `AuthGatewaySupabase`. Criar um
   * cliente separado aqui perdia a sessão e fazia o RLS do Supabase rejeitar
   * todo envio como anônimo.
   */
  constructor(
    private readonly client: SupabaseClient,
    private readonly authGateway?: AuthGateway
  ) {}

  /**
   * Envia um evento do outbox para o Supabase via upsert na tabela
   * correspondente.
   */
  async sincronizarItem(evento: OutboxEvent): Promise<void> {
    const tabela = this.normalizarTabela(evento.tabela);
    const payload = this.normalizarPayload(tabela, evento.payload);
    const onConflict = tabela === 'users' ? 'email' : 'id';

    const enviar = async (): Promise<void> => {
      const { error } = await this.client
        .from(tabela)
        .upsert(payload, {
          // A chave de dedup do outbox não é coluna do Supabase. Para `users`,
          // conflita por `email` (evita 409 com seeds); nas demais, por `id`.
          onConflict,
        });

      if (error) {
        this.tratarErroSupabase(error);
      }
    };

    try {
      await enviar();
    } catch (erro: any) {
      // Erro já traduzido por `tratarErroSupabase`: preservar transitoriedade e
      // status. Sem isto, um 4xx permanente vira 5xx transitório e entra em
      // retry infinito, violando C-05.
      if (erro instanceof ErroSincronizacao) {
        // 401: tentar renovar a sessão e reenviar uma vez antes de desistir.
        if (erro.statusCode === 401 && this.authGateway) {
          try {
            const bruta = await this.authGateway.obterSessaoSalvaBruta();
            if (bruta?.refreshToken) {
              await this.authGateway.renovarSessao(bruta.refreshToken);
              await enviar();
              return;
            }
          } catch {
            // Renovação falhou: cai no throw abaixo como transitório.
          }
          throw new ErroSincronizacao(erro.message, true, 401);
        }
        throw erro;
      }

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

  private normalizarTabela(tabela: string): string {
    return tabela === 'item_checklist' ? 'itens_checklist' : tabela;
  }

  private normalizarPayload(
    tabela: string,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const possuiLegado =
      'percentual_vistoria' in payload ||
      'tipo' in payload ||
      'fotos' in payload ||
      'dataCriacao' in payload ||
      'aprovador_id' in payload ||
      'solicitante_id' in payload ||
      'motivo' in payload ||
      (tabela === 'vistorias' && 'vistoria_id' in payload);

    if (!possuiLegado) {
      return payload;
    }

    const limpo: Record<string, unknown> = { ...payload };

    if ('dataCriacao' in limpo && !('data_criacao' in limpo)) {
      limpo.data_criacao = limpo.dataCriacao;
    }
    if (tabela === 'vistorias' && 'vistoria_id' in limpo && !('id' in limpo)) {
      limpo.id = limpo.vistoria_id;
    }
    if (tabela === 'vistorias') {
      if (limpo.tipo === 'VISTORIA_APROVADA' && !('status' in limpo)) {
        limpo.status = 'APROVADA';
      } else if (limpo.tipo === 'VISTORIA_DEVOLVIDA' && !('status' in limpo)) {
        limpo.status = 'DEVOLVIDA';
      }
      if ('aprovador_id' in limpo && !('aprovado_por' in limpo)) {
        limpo.aprovado_por = limpo.aprovador_id;
      }
      if ('solicitante_id' in limpo && !('devolvido_por' in limpo)) {
        limpo.devolvido_por = limpo.solicitante_id;
      }
      if ('motivo' in limpo && !('motivo_devolucao' in limpo)) {
        limpo.motivo_devolucao = limpo.motivo;
      }
      delete limpo.vistoria_id;
      delete limpo.aprovador_id;
      delete limpo.solicitante_id;
      delete limpo.motivo;
    }

    delete limpo.tipo;
    delete limpo.fotos;
    delete limpo.dataCriacao;
    delete limpo.percentual_vistoria;

    return limpo;
  }
}