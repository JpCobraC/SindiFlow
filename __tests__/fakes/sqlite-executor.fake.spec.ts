import { SQLiteExecutorFake } from './sqlite-executor.fake';

/**
 * O duplo de execução de SQL precisa ser confiável **antes** de medir qualquer
 * coisa com ele: todos os repositórios SQLite da Fase 1 vão ser testados contra
 * ele. Um duplo que mente produz falso verde — e o teste mais perigoso é o de
 * rollback, que passa sem que exista rollback.
 *
 * Não está em `src/` de propósito: os `*.fake.ts` atuais são importados pelo
 * contexto e entram no bundle de produção. Este é duplo de teste e não deve
 * embarcar (D-12).
 */
describe('SQLiteExecutorFake', () => {
  describe('registro', () => {
    it('registra o sql e os params de cada executar', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.executar('UPDATE vistorias SET updated_at = ? WHERE id = ?', [
        '2026-10-16T10:00:00.000Z',
        'vist-1',
      ]);

      expect(executor.registros).toEqual([
        {
          sql: 'UPDATE vistorias SET updated_at = ? WHERE id = ?',
          params: ['2026-10-16T10:00:00.000Z', 'vist-1'],
        },
      ]);
    });

    it('normaliza params ausentes para lista vazia', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.executar('PRAGMA user_version = 1');

      expect(executor.registros[0].params).toEqual([]);
    });
  });

  describe('consulta', () => {
    it('devolve as linhas programadas para o SQL', async () => {
      const executor = new SQLiteExecutorFake().definirResultado('FROM vistorias', [
        { id: 'vist-1' },
        { id: 'vist-2' },
      ]);

      const linhas = await executor.consultar<{ id: string }>('SELECT * FROM vistorias');

      expect(linhas).toEqual([{ id: 'vist-1' }, { id: 'vist-2' }]);
    });

    it('devolve lista vazia quando nenhum resultado foi programado', async () => {
      const executor = new SQLiteExecutorFake();

      expect(await executor.consultar('SELECT * FROM vistorias')).toEqual([]);
    });

    it('escolhe o resultado cujo marcador casa com o SQL', async () => {
      const executor = new SQLiteExecutorFake()
        .definirResultado('FROM outbox_events', [{ id: 'out-1' }])
        .definirResultado('FROM vistorias', [{ id: 'vist-1' }]);

      expect(await executor.consultar('SELECT * FROM outbox_events')).toEqual([{ id: 'out-1' }]);
      expect(await executor.consultar('SELECT * FROM vistorias')).toEqual([{ id: 'vist-1' }]);
    });

    it('registra a consulta no registro de execuções', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.consultar('SELECT * FROM vistorias WHERE id = ?', ['vist-1']);

      expect(executor.registros[0]).toEqual({
        sql: 'SELECT * FROM vistorias WHERE id = ?',
        params: ['vist-1'],
      });
    });

    it('consultarUm devolve a primeira linha', async () => {
      const executor = new SQLiteExecutorFake().definirResultado('FROM vistorias', [
        { id: 'vist-1' },
        { id: 'vist-2' },
      ]);

      const linha = await executor.consultarUm<{ id: string }>('SELECT * FROM vistorias');

      expect(linha).toEqual({ id: 'vist-1' });
    });

    it('consultarUm devolve null quando não há linha', async () => {
      const executor = new SQLiteExecutorFake();

      const linha = await executor.consultarUm('SELECT * FROM vistorias WHERE id = ?', ['inexistente']);

      expect(linha).toBeNull();
    });
  });

  describe('resultado da escrita', () => {
    it('devolve o número de alterações', async () => {
      const executor = new SQLiteExecutorFake();

      const resultado = await executor.executar('DELETE FROM outbox_events WHERE status = ?', [
        'SINCRONIZADO',
      ]);

      expect(resultado.alteracoes).toBe(1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Contagem programável.
    //
    // Sem isto, `executar` devolve sempre 1 e qualquer asserção sobre contagem é
    // trivialmente verdadeira. O caso que importa é o zero: `descartarSincronizados`
    // promete `Promise<number>` e devolve quantos registros a retenção apagou — e a
    // retenção que roda numa base vazia apaga zero. Um duplo que só devolve 1 não
    // prova isso, e o repositório pode devolver a contagem errada sem que nenhum
    // teste note.
    // ─────────────────────────────────────────────────────────────────────────

    it('devolve o número de alterações programado', async () => {
      const executor = new SQLiteExecutorFake().definirAlteracoes('DELETE FROM outbox_events', 3);

      const resultado = await executor.executar('DELETE FROM outbox_events WHERE status = ?', [
        'SINCRONIZADO',
      ]);

      expect(resultado.alteracoes).toBe(3);
    });

    it('um DELETE que não apaga nada devolve zero', async () => {
      const executor = new SQLiteExecutorFake().definirAlteracoes('DELETE FROM outbox_events', 0);

      const resultado = await executor.executar('DELETE FROM outbox_events WHERE status = ?', [
        'SINCRONIZADO',
      ]);

      expect(resultado.alteracoes).toBe(0);
    });

    it('devolve 1 por padrão quando nada foi programado', async () => {
      // Guarda: passa antes e depois. Documenta o default.
      const executor = new SQLiteExecutorFake();

      const resultado = await executor.executar('INSERT INTO vistorias (id) VALUES (?)', ['v1']);

      expect(resultado.alteracoes).toBe(1);
    });

    it('a programação não afeta outro SQL', async () => {
      // Guarda: passa antes e depois. Impede que a contagem vaze entre comandos.
      const executor = new SQLiteExecutorFake().definirAlteracoes('DELETE FROM outbox_events', 3);

      const resultado = await executor.executar('DELETE FROM vistorias WHERE id = ?', ['v1']);

      expect(resultado.alteracoes).toBe(1);
    });

    it('a última programação do mesmo SQL vence', async () => {
      // Guarda: passa antes e depois. Fixa a precedência.
      const executor = new SQLiteExecutorFake()
        .definirAlteracoes('DELETE FROM outbox_events', 3)
        .definirAlteracoes('DELETE FROM outbox_events', 7);

      const resultado = await executor.executar('DELETE FROM outbox_events WHERE status = ?', [
        'SINCRONIZADO',
      ]);

      expect(resultado.alteracoes).toBe(7);
    });
  });

  describe('transação', () => {
    it('entrega um executor utilizável no callback', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);
      });

      expect(executor.registros).toHaveLength(1);
    });

    it('devolve o valor que a operação retornou', async () => {
      const executor = new SQLiteExecutorFake();

      const resultado = await executor.emTransacao(async () => 42);

      expect(resultado).toBe(42);
    });

    it('confirma as escritas ao resolver', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);
        await tx.executar('INSERT INTO outbox_events (id) VALUES (?)', ['out-1']);
      });

      expect(executor.confirmadas).toHaveLength(2);
    });

    it('DESCARTA as escritas quando a operação lança', async () => {
      // O teste que carrega este passo inteiro. `descartarSincronizados` e a
      // atomicidade `salvar` + `enfileirar` da §1.3 dependem deste comportamento:
      // sem descarte, um erro no meio deixaria a vistoria gravada sem o evento
      // na fila — dado perdido sem rastro.
      const executor = new SQLiteExecutorFake();

      await expect(
        executor.emTransacao(async (tx) => {
          await tx.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);
          throw new Error('falha no meio');
        })
      ).rejects.toThrow('falha no meio');

      expect(executor.confirmadas).toHaveLength(0);
    });

    it('preserva em `registros` a escrita que foi desfeita', async () => {
      // Distingue "não tentou" de "tentou e desfez" — é o que permite diagnosticar
      // uma falha de atomicidade.
      const executor = new SQLiteExecutorFake();

      await expect(
        executor.emTransacao(async (tx) => {
          await tx.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);
          throw new Error('falha');
        })
      ).rejects.toThrow();

      expect(executor.registros).toHaveLength(1);
      expect(executor.confirmadas).toHaveLength(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Transação aninhada.
    //
    // O SQLite real NÃO aninha: `withTransactionAsync` recebe um callback sem
    // argumento. Um duplo que aceita aninhamento mente sobre persistência — e a
    // mentira aqui era grave, porque `salvar` + `enfileirar` atômicos (§1.3) é
    // justamente o caso em que um caso de uso abre a transação e chama dois
    // repositórios.
    // ─────────────────────────────────────────────────────────────────────────

    it('recusa transação aninhada', async () => {
      const executor = new SQLiteExecutorFake();

      await expect(
        executor.emTransacao(async (tx) => {
          await tx.emTransacao(async () => {
            // nunca deve rodar
          });
        })
      ).rejects.toThrow(/aninhada/i);
    });

    it('a recusa não apaga o que a externa já tinha escrito', async () => {
      // Regressão do defeito: a chamada aninhada zerava o buffer da transação
      // externa, e a primeira escrita sumia sem erro nem rastro.
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT A');
        try {
          await tx.emTransacao(async () => {
            /* recusada */
          });
        } catch {
          /* a recusa é esperada */
        }
        await tx.executar('INSERT B');
      });

      expect(executor.confirmadas.map((e) => e.sql)).toEqual(['INSERT A', 'INSERT B']);
    });

    it('não confirma nada da transação aninhada recusada', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT A');
        try {
          await tx.emTransacao(async (txInterno) => {
            await txInterno.executar('INSERT ANINHADO');
          });
        } catch {
          /* a recusa é esperada */
        }
      });

      expect(executor.confirmadas.map((e) => e.sql)).toEqual(['INSERT A']);
    });

    it('a transação externa continua aberta após a recusa', async () => {
      // Guarda de comportamento: passa tanto antes quanto depois da correção, e
      // por isso não é RED. Fica para travar a profundidade.
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT A');
        try {
          await tx.emTransacao(async () => {
            /* recusada */
          });
        } catch {
          /* a recusa é esperada */
        }
        expect(executor.transacoesAbertas).toBe(1);
      });

      expect(executor.transacoesAbertas).toBe(0);
    });

    it('não deixa transação aberta após uma exceção', async () => {
      const executor = new SQLiteExecutorFake();

      await expect(
        executor.emTransacao(async () => {
          throw new Error('falha');
        })
      ).rejects.toThrow();

      expect(executor.transacoesAbertas).toBe(0);
    });

    it('não deixa transação aberta após resolver normalmente', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.emTransacao(async (tx) => {
        await tx.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);
      });

      expect(executor.transacoesAbertas).toBe(0);
    });

    it('escrita fora de transação é confirmada na hora', async () => {
      const executor = new SQLiteExecutorFake();

      await executor.executar('INSERT INTO vistorias (id) VALUES (?)', ['vist-1']);

      expect(executor.confirmadas).toHaveLength(1);
      expect(executor.registros).toHaveLength(1);
    });
  });
});