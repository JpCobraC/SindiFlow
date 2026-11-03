import { OutboxEvent } from '../entities/outbox-event.entity';

/**
 * Porta de sincronização remota — `sindiflow-obrigacoes.md` §1.3.
 *
 * Deliberadamente retorna `Promise<void>` e **não** `Promise<boolean>`. O contrato
 * anterior devolvia um booleano que o único chamador ignorava
 * (`sincronizar-outbox.usecase.ts`), de modo que um adapter real devolvendo
 * `false` — usuário revogado, payload rejeitado — marcava o evento como
 * sincronizado e o dado sumia sem erro. Agora a falha só pode ser sinalizada
 * lançando, e erro de verdade é `ErroSincronizacao`, com o sinalizador
 * `transitorio` que C-05 precisa.
 */
export interface IRemoteSyncGateway {
  sincronizarItem(evento: OutboxEvent): Promise<void>;
}
