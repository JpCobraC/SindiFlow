import {
  ISQLiteExecutor,
  SqlParam,
  ResultadoExecucao,
} from '../../src/adapters/repositories/sqlite-executor.interface';

type Linha = Record<string, unknown>;
type Tabela = Map<string, Linha>;

function normalizar(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function dividirPorVirgula(texto: string): string[] {
  return texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function literal(valor: string): unknown {
  const semEspacos = valor.trim();
  if (/^NULL$/i.test(semEspacos)) return null;
  if (/^TRUE$/i.test(semEspacos)) return 1;
  if (/^FALSE$/i.test(semEspacos)) return 0;
  if (/^'.*'$/.test(semEspacos)) return semEspacos.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(semEspacos)) return Number(semEspacos);
  return semEspacos;
}

/**
 * Duplo de teste com estado em memória para os repositórios SQLite.
 *
 * Diferente do duplo de espião (`sqlite-executor.fake.ts`), este fake
 * interpreta o subconjunto de SQL usado pelos repositórios e mantém as linhas
 * entre chamadas. Isso permite testar `salvar()` seguido de `buscarPorId()` sem
 * um banco nativo.
 *
 * A implementação é deliberadamente pequena: suporta INSERT (com ON CONFLICT),
 * UPDATE, DELETE e SELECT com filtros simples. O objetivo é validar mapeamento
 * entidade ↔ linha, não substituir o SQLite real.
 */
export class SQLiteExecutorFake implements ISQLiteExecutor {
  private readonly tabelas = new Map<string, Tabela>();
  private sequencia = 0;

  private tabela(nome: string): Tabela {
    let tabela = this.tabelas.get(nome);
    if (!tabela) {
      tabela = new Map();
      this.tabelas.set(nome, tabela);
    }
    return tabela;
  }

  private inserir(sql: string, params: SqlParam[]): ResultadoExecucao {
    const match = sql.match(
      /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/i
    );
    if (!match) return { alteracoes: 0 };

    const nome = match[1];
    const colunas = dividirPorVirgula(match[2]);
    const valoresSql = dividirPorVirgula(match[3]);
    const linha: Linha = {};

    let indiceParam = 0;
    for (let i = 0; i < colunas.length; i++) {
      const valorSql = valoresSql[i] ?? 'NULL';
      linha[colunas[i]] =
        valorSql === '?' ? (params[indiceParam++] ?? null) : literal(valorSql);
    }

    const id = String(linha.id ?? linha.chave_dedup ?? `auto-${++this.sequencia}`);
    const tabela = this.tabela(nome);
    const existente = tabela.get(id);
    tabela.set(id, existente ? { ...existente, ...linha } : linha);

    return { alteracoes: 1 };
  }

  private atualizar(sql: string, params: SqlParam[]): ResultadoExecucao {
    const match = sql.match(
      /^UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]+)$/i
    );
    if (!match) return { alteracoes: 0 };

    const nome = match[1];
    const atribuicoes = dividirPorVirgula(match[2]);
    const where = match[3];
    const alteracoes: Array<[string, unknown]> = [];

    let indiceParam = 0;
    for (const atribuicao of atribuicoes) {
      const igual = atribuicao.indexOf('=');
      if (igual < 0) continue;
      const coluna = atribuicao.slice(0, igual).trim();
      const valorSql = atribuicao.slice(igual + 1).trim();
      alteracoes.push([
        coluna,
        valorSql === '?' ? (params[indiceParam++] ?? null) : literal(valorSql),
      ]);
    }

    const linhas = this.filtrar(nome, where, params.slice(indiceParam));
    for (const linha of linhas) {
      for (const [coluna, valor] of alteracoes) {
        linha[coluna] = valor;
      }
    }

    return { alteracoes: linhas.length };
  }

  private remover(sql: string, params: SqlParam[]): ResultadoExecucao {
    const match = sql.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) return { alteracoes: 0 };

    const nome = match[1];
    const where = match[2];
    const linhas = where ? this.filtrar(nome, where, params) : Array.from(this.tabela(nome).values());
    const tabela = this.tabela(nome);

    for (const linha of linhas) {
      const id = String(linha.id ?? linha.chave_dedup ?? '');
      if (id) tabela.delete(id);
    }

    return { alteracoes: linhas.length };
  }

  private filtrar(nome: string, where: string | null | undefined, params: SqlParam[]): Linha[] {
    const linhas = Array.from(this.tabela(nome).values());
    if (!where) return linhas;

    const condicoes: Array<{ coluna: string; operador: string; valor: unknown }> = [];
    const regex =
      /(\w+)\s*(?:(IS\s+NOT\s+NULL|IS\s+NULL)|(<=|>=|=|<|>)\s*(NULL|\?|'[^']*'|-?\d+(?:\.\d+)?))/gi;
    let match: RegExpExecArray | null;
    let indiceParam = 0;

    while ((match = regex.exec(where)) !== null) {
      const [, coluna, operadorNulo, operadorComparacao, valorSql] = match;
      const operador = (operadorNulo ?? operadorComparacao)
        .toUpperCase()
        .replace(/\s+/g, ' ');
      let valor: unknown = null;
      if (valorSql === '?') {
        valor = params[indiceParam++] ?? null;
      } else if (valorSql && !/^NULL$/i.test(valorSql)) {
        valor = literal(valorSql);
      }
      condicoes.push({ coluna, operador, valor });
    }

    if (condicoes.length === 0) return linhas;

    // Condições sobre a mesma coluna são tratadas como OR. É o caso de
    // `(data_ultima_tentativa IS NULL OR data_ultima_tentativa < ?)` em
    // `obterPendentes`; condições de colunas diferentes continuam sendo AND.
    const porColuna = new Map<string, typeof condicoes>();
    for (const condicao of condicoes) {
      const grupo = porColuna.get(condicao.coluna) ?? [];
      grupo.push(condicao);
      porColuna.set(condicao.coluna, grupo);
    }

    return linhas.filter((linha) =>
      Array.from(porColuna.values()).every((grupo) =>
        grupo.some(({ coluna, operador, valor }) => {
          const atual = linha[coluna];
          if (operador === 'IS NULL') return atual === null || atual === undefined;
          if (operador === 'IS NOT NULL') return atual !== null && atual !== undefined;
          if (atual === null || atual === undefined) return false;
          if (operador === '=') return String(atual) === String(valor);
          if (operador === '<') return String(atual) < String(valor);
          if (operador === '>') return String(atual) > String(valor);
          if (operador === '<=') return String(atual) <= String(valor);
          if (operador === '>=') return String(atual) >= String(valor);
          return true;
        })
      )
    );
  }

  async executar(sql: string, params: SqlParam[] = []): Promise<ResultadoExecucao> {
    const comando = normalizar(sql);

    if (/^INSERT\s/i.test(comando)) {
      return this.inserir(comando, params);
    }
    if (/^UPDATE\s/i.test(comando)) {
      return this.atualizar(comando, params);
    }
    if (/^DELETE\s/i.test(comando)) {
      return this.remover(comando, params);
    }

    return { alteracoes: 0 };
  }

  async consultar<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const comando = normalizar(sql);
    const match = comando.match(
      /^SELECT\s+[\s\S]*?\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+ORDER\s+BY[\s\S]*)?(?:\s+LIMIT[\s\S]*)?$/i
    );
    if (!match) return [];

    return this.filtrar(match[1], match[2], params) as T[];
  }

  async consultarUm<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const linhas = await this.consultar<T>(sql, params);
    return linhas.length > 0 ? linhas[0] : null;
  }

  async emTransacao<T>(operacao: (tx: ISQLiteExecutor) => Promise<T>): Promise<T> {
    return operacao(this);
  }
}
