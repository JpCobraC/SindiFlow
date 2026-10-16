import type { SQLiteDatabase } from 'expo-sqlite';

import {
  ISQLiteExecutor,
  ResultadoExecucao,
  SqlParam,
} from '../../adapters/repositories/sqlite-executor.interface';

/**
 * Implementação real da porta `ISQLiteExecutor` sobre o `expo-sqlite`.
 *
 * ## Por que ela ainda não tem teste
 *
 * O `expo-sqlite` **não roda sob Jest** (C-15, verificado em 16/10/2026): no
 * project `core` o ts-jest não parseia o ESM do pacote, e no project `ui` não há
 * SQLite nativo — `openDatabaseSync` falha com `NativeDatabase is not a
 * constructor`. Não há mock oficial no `jest-expo`.
 *
 * Consequência aceita: **esta classe não tem teste de runtime, e não pode ter
 * ainda.** O que se pode verificar agora é a *assinatura*, e é para isso que ela
 * existe nesta altura da Fase 1 — confrontar a porta com a API real enquanto
 * ainda não há repositório escrito em cima dela. Mudar a porta agora é barato;
 * mudar depois de quatro repositórios, não.
 *
 * | Verificado pelo `tsc` | Só verificável no aparelho |
 * |---|---|
 * | `SqlParam[]` é atribuível a `SQLiteBindParams` | se `runAsync` executa o que pedimos |
 * | `SQLiteRunResult.changes` existe e é `number` | se a transação isola de verdade |
 * | `getFirstAsync` devolve `T \| null` | se o callback roda dentro da transação |
 * | `ISQLiteExecutor` está implementada por completo | se o DDL é aceito |
 *
 * ## O `import` é só de tipo
 *
 * `import type` significa que o JavaScript emitido não referencia `expo-sqlite`:
 * esta classe apenas chama métodos no handle que recebe. Isso é deliberado —
 * mantém o arquivo sem dependência de runtime, e enquanto nada a importar o
 * `expo export` segue sem `expo-sqlite` no bundle.
 *
 * ## Sem guarda de transação aninhada aqui
 *
 * O duplo de teste recusa aninhamento (`SQLiteExecutorFake.emTransacao`). Esta
 * classe **não** recusa, e a assimetria é intencional: quem garante que ninguém
 * aninha é o teste, e o comportamento em produção é o do SDK. Adicionar defesa
 * aqui seria mais código sem teste — o oposto do princípio de superfície mínima
 * que guiou o desenho da porta.
 */
export class ExpoSQLiteExecutor implements ISQLiteExecutor {
  /**
   * @param db Handle já aberto. Esta classe **não** abre conexão nem roda
   * migration: quem faz isso é o módulo de infra do banco, no passo 4 da Fase 1.
   */
  constructor(private readonly db: SQLiteDatabase) {}

  public async executar(sql: string, params: SqlParam[] = []): Promise<ResultadoExecucao> {
    const resultado = await this.db.runAsync(sql, params);
    // `changes`, nunca `lastInsertRowId`: a porta promete quantas linhas foram
    // afetadas, que é o que `descartarSincronizados` devolve.
    return { alteracoes: resultado.changes };
  }

  public async consultar<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  public async consultarUm<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params);
  }

  /**
   * A API real é `withTransactionAsync(task: () => Promise<void>): Promise<void>`:
   * o callback não recebe handle nenhum e não devolve valor. A porta promete
   * `(tx) => Promise<T>` devolvendo `Promise<T>`, então o valor volta por captura
   * de closure — o executor passado é `this`, que opera no mesmo handle.
   */
  public async emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T> {
    let resultado!: T;
    await this.db.withTransactionAsync(async () => {
      resultado = await operacao(this);
    });
    return resultado;
  }
}