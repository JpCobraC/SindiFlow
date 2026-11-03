/**
 * Porta de execução de SQL — o contrato que os repositórios SQLite usam.
 *
 * **Por que fica em `adapters/` e não em `domain/interfaces/`:** `domain` não pode
 * carregar conceito de outra camada. SQL não é conceito de domínio, e uma porta
 * aqui dentro colocaria a camada mais pura falando a língua da mais externa.
 *
 * **Por que não fica em `infra/`:** `infra` é a camada mais externa (§2.1) e não
 * pode ser importada por `adapters`. Quem implementa esta porta é `infra`
 * (`ExpoSQLiteExecutor`), e como `infra` depende de tudo, a seta aponta para
 * dentro — nunca ao contrário.
 *
 * **Superfície mínima, deliberada.** O `expo-sqlite` não roda sob Jest (C-15,
 * verificado em 16/10/2026), então a implementação real não terá teste unitário.
 * Cada método a mais aqui é um método a mais para confiar apenas por leitura.
 *
 * Decisões que valem explicitar:
 *
 * - `SqlParam` é um **subconjunto** de `SQLiteBindValue`. O SDK aceita
 *   `string | number | null | boolean | Uint8Array | ArrayBuffer`; a porta aceita
 *   `string | number | boolean | null`. Exclui duas coisas, cada uma por motivo:
 *   - **`Date`**: não é tipo de bind do SQLite. Excluí-lo obriga o repositório a
 *     converter para ISO 8601 na mão, de forma explícita. A conversão implícita é
 *     onde moram os bugs de dado silenciosos — foi assim que um `NaN` de GPS
 *     atravessou a validação e chegou ao disco.
 *   - **`Uint8Array`/`ArrayBuffer`**: é a proteção da §1.4. Nenhum byte de imagem
 *     entra pelo bind; foto é referência por caminho no FileSystem.
 *   `boolean` **é** aceito — o SQLite tem esse tipo, e excluí-lo seria errado.
 * - `executar` devolve `alteracoes` porque `IOutboxRepository.descartarSincronizados`
 *   promete `Promise<number>`.
 * - `emTransacao` entrega um executor com escopo, em vez de `begin`/`commit`/
 *   `rollback` soltos, para o rollback não poder ser esquecido.
 *
 * ## Decisão B2 — DDL e migrations NÃO passam por aqui
 *
 * `CREATE TABLE`, `DROP` e `PRAGMA user_version` são trabalho de `infra`, não de
 * repositório: são executados uma vez, na abertura do banco, pelo módulo de
 * migração — nunca por um repositório durante uma operação de vistoria.
 *
 * **Não adicione `executarScript` a esta porta.** Parece a solução quando as
 * migrations do passo 4 batem na parede, mas seria errado por duas razões: o
 * `execAsync` do SDK é `void` e não aceita params, então o método não teria a
 * mesma forma dos outros; e cada método aqui é código de produção que não tem
 * como ser testado (C-15), então a superfície precisa ficar mínima.
 */

/** Valores aceitos por bind. SQLite não tem boolean nem Date: converter é do repositório. */
export type SqlParam = string | number | boolean | null;

export interface ResultadoExecucao {
  /** Linhas afetadas por INSERT/UPDATE/DELETE. */
  alteracoes: number;
}

export interface ISQLiteExecutor {
  /** INSERT / UPDATE / DELETE / PRAGMA. */
  executar(sql: string, params?: SqlParam[]): Promise<ResultadoExecucao>;

  /** SELECT que devolve várias linhas. */
  consultar<T>(sql: string, params?: SqlParam[]): Promise<T[]>;

  /** SELECT por chave — `buscarPorId` de todos os repositórios. */
  consultarUm<T>(sql: string, params?: SqlParam[]): Promise<T | null>;

  /**
   * Entrega um executor com o mesmo escopo, já dentro da transação.
   *
   * É assim que `salvar` + `enfileirar` ficam atômicos, que é o que a §1.3 exige:
   * `await executor.emTransacao(async (tx) => { await tx.executar(...); })`.
   */
  emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T>;
}