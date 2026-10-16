import {
  ISQLiteExecutor,
  ResultadoExecucao,
  SqlParam,
} from '../../src/adapters/repositories/sqlite-executor.interface';

export interface ExecucaoRegistrada {
  sql: string;
  params: SqlParam[];
}

/**
 * Duplo de teste para `ISQLiteExecutor`.
 *
 * Existe porque o `expo-sqlite` **não roda sob Jest** (C-15): no project `core`
 * o ts-jest não parseia o ESM do pacote, e no project `ui` não há SQLite nativo.
 * Os repositórios SQLite da Fase 1 serão testados contra este duplo; a
 * compatibilidade do SQL e do DDL com o SQLite real fica para verificação em
 * dispositivo.
 *
 * **A separação entre `registros` e `confirmadas` é o ponto inteiro deste
 * duplo.** Sem staging, um duplo que escreve direto no log "confirmado" faz o
 * teste de rollback passar sem que exista rollback — falso verde em cima da
 * garantia de atomicidade da §1.3.
 *
 * Não fica em `src/`: os `*.fake.ts` atuais são importados pelo contexto e
 * entram no bundle de produção. Este é duplo de teste e não deve embarcar (D-12).
 */
/** Programação de contagem de alterações, casada por substring do SQL. */
export interface AlteracoesProgramada {
  quando: string;
  alteracoes: number;
}

export class SQLiteExecutorFake implements ISQLiteExecutor {
  /** Tudo que foi executado, inclusive o que a transação depois desfez. */
  readonly registros: ExecucaoRegistrada[] = [];

  /** Só o que foi confirmado. É este que um teste de persistência consulta. */
  readonly confirmadas: ExecucaoRegistrada[] = [];

  /** Linhas que `consultar` devolve, por casamento de substring do SQL. */
  private readonly respostas: Array<{ quando: string; linhas: unknown[] }> = [];

  /** Contagens de alterações programadas, por casamento de substring do SQL. */
  private readonly contagens: AlteracoesProgramada[] = [];

  /** Escritas da transação em aberto. Descartadas se a operação lançar. */
  private buffer: ExecucaoRegistrada[] = [];

  private profundidade = 0;

  /** Programa o resultado de um `consultar` cujo SQL contenha `quando`. */
  definirResultado<T>(quando: string, linhas: T[]): this {
    this.respostas.push({ quando, linhas });
    return this;
  }

  /** Programa quantas linhas a escrita correspondente altera. */
  definirAlteracoes(quando: string, alteracoes: number): this {
    this.contagens.push({ quando, alteracoes });
    return this;
  }

  /** Quantas transações estão abertas agora. Serve para detectar `aninhamento indevido`. */
  get transacoesAbertas(): number {
    return this.profundidade;
  }

  /**
   * Última programação que casa com o SQL.
   *
   * Varre de trás para frente de propósito: a **última** programação vence, para
   * que um teste possa sobrescrever um default. `definirResultado` e
   * `definirAlteracoes` usam a mesma regra — ter dois Criteria diferentes no mesmo
   * duplo seria uma fonte de confusão sem motivo.
   */
  private ultimar<T>(lista: Array<{ quando: string } & T>, sql: string): T | undefined {
    for (let i = lista.length - 1; i >= 0; i--) {
      if (sql.includes(lista[i].quando)) {
        return lista[i];
      }
    }
    return undefined;
  }

  public async executar(sql: string, params: SqlParam[] = []): Promise<ResultadoExecucao> {
    const execucao: ExecucaoRegistrada = { sql, params };
    this.registros.push(execucao);

    if (this.profundidade > 0) {
      this.buffer.push(execucao);
    } else {
      this.confirmadas.push(execucao);
    }

    return { alteracoes: this.ultimar(this.contagens, sql)?.alteracoes ?? 1 };
  }

  public async consultar<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    this.registros.push({ sql, params });
    return (this.ultimar(this.respostas, sql)?.linhas ?? []) as T[];
  }

  public async consultarUm<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const linhas = await this.consultar<T>(sql, params);
    return linhas.length > 0 ? linhas[0] : null;
  }

  public async emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T> {
    // Guarda ANTES de qualquer efeito colateral. Sem ela, a chamada aninhada
    // zerava o `buffer` da transação externa — a primeira escrita sumia sem erro
    // nem rastro — e confirmava o próprio conteúdo, o que impedia o rollback
    // externo de desfazer.
    //
    // Lançar, e não joining na externa: o `withTransactionAsync` real não aninha.
    // Código que aninha quebraria no aparelho de qualquer forma; falhar aqui
    // transforma isso em erro de teste em vez de dado perdido em campo.
    if (this.profundidade > 0) {
      throw new Error(
        'Transação aninhada não é suportada. O SQLite não aninha: componha em uma ' +
          'única transação externa que chame os dois repositórios.'
      );
    }

    this.profundidade += 1;
    this.buffer = [];

    try {
      const resultado = await operacao(this);
      // Confirma: o que estava no buffer passa a ser persistido.
      this.confirmadas.push(...this.buffer);
      return resultado;
    } catch (erro) {
      // Descarta: nada vai para `confirmadas`. O `registros` já tem tudo, o que
      // permite afirmar "foi tentado e desfeito" em vez de só "não sobrou nada".
      throw erro;
    } finally {
      this.buffer = [];
      this.profundidade -= 1;
    }
  }
}