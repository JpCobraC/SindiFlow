import { OperacaoOutbox, OutboxEvent } from '../entities/outbox-event.entity';

/**
 * Dados de entrada para enfileirar um evento. Declarado explicitamente, e não
 * derivado da entidade por `Omit`: derivar preserva `dataCriacao` como obrigatório
 * e acaba exigindo do adapter um campo que ele mesmo deveria decidir.
 *
 * `id` e `dataCriacao` são opcionais: em produção o repositório os atribui; nos
 * testes, um instante fixo torna prazo de retry determinístico.
 */
export interface DadosOutbox {
  id?: string;
  tabela: string;
  operacao: OperacaoOutbox;
  payload: Record<string, unknown>;
  usuarioId: string;
  deviceId: string;
  maxTentativas?: number;
  dataCriacao?: Date;
}

/**
 * Porta da fila de saída — `sindiflow-obrigacoes.md` §1.3.
 *
 * O retorno é `OutboxEvent`, e não um DTO plano: o DDL de `outbox_events` tem
 * `status`, `proximo_retry_ms`, `ultimo_erro` e `data_sincronizacao`, e o antigo
 * `ItemOutbox` não tinha nenhum desses campos, o que tornava o dead-letter
 * (`FALHA_MAXIMA`) impossível de representar de ponta a ponta.
 *
 * Todos os métodos recebem o instante de referência. Sem ele, prazo de retry e
 * limite de SLA não são testáveis de forma determinística.
 */
export interface IOutboxRepository {
  enfileirar(dados: DadosOutbox): Promise<OutboxEvent>;

  /** Só devolve eventos `PENDENTE` cujo prazo de retry já venceu. */
  obterPendentes(agora?: Date, limite?: number): Promise<OutboxEvent[]>;

  /**
   * Transição `PENDENTE → PROCESSANDO`, **persistida pelo repositório**.
   *
   * Não é exagerado: o adapter SQLite devolve entidades hidratadas, e mutar a
   * cópia em memória não grava nada. Sem este método na porta, o `PROCESSANDO`
   * existiria só enquanto o processo vive, e a coluna do DDL nunca receberia valor.
   *
   * Lança `OutboxNaoProcessavelError` se o evento não estiver despachável.
   */
  iniciarProcessamento(id: string): Promise<OutboxEvent>;

  listarTodos(): Promise<OutboxEvent[]>;

  /** Marca `SINCRONIZADO`. O evento **permanece** — §3.3 exige trilha de auditoria. */
  marcarSincronizado(id: string, dataSync?: Date): Promise<void>;

  registrarFalha(id: string, erro: string, agora?: Date): Promise<void>;

  /** Dead-letter imediato (4xx, payload inválido). Resolve C-05. */
  registrarFalhaPermanente(id: string, erro: string, agora?: Date): Promise<void>;

  /** Devolve um evento em `FALHA_MAXIMA` à fila ativa. Lacuna C-01. */
  resetar(id: string): Promise<void>;

  /** Apaga o que já foi sincronizado antes de `anteriorA`. Política de retenção. */
  descartarSincronizados(anteriorA: Date): Promise<number>;
}
