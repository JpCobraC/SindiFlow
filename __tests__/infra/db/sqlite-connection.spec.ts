/**
 * Testes para sqlite-connection.ts
 *
 * Como `expo-sqlite` não roda sob Jest (C-15), mockamos o módulo e
 * testamos a lógica de abertura do banco e execução do DDL.
 */
import { openDatabaseSync } from 'expo-sqlite';
import { openSindiFlowDatabase, createSindiFlowExecutor } from '../../../src/infra/db/sqlite-connection';
import { SQLITE_SCHEMA_DDL } from '../../../src/infra/db/sqlite-schema';
import { ExpoSQLiteExecutor } from '../../../src/infra/db/expo-sqlite.executor';

jest.mock('expo-sqlite', () => {
  const execSync = jest.fn();
  const getFirstSync = jest.fn();
  return {
    openDatabaseSync: jest.fn(() => ({
      execSync,
      getFirstSync,
    })),
    __execSync: execSync,
    __getFirstSync: getFirstSync,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('openSindiFlowDatabase', () => {
  it('deve abrir o banco com o nome padrão', () => {
    openSindiFlowDatabase();
    expect(openDatabaseSync).toHaveBeenCalledWith('sindiflow.db');
  });

  it('deve executar o DDL completo ao abrir', () => {
    openSindiFlowDatabase();
    const execSync = (openDatabaseSync as jest.Mock).mock.results[0].value.execSync;
    expect(execSync).toHaveBeenCalledWith(SQLITE_SCHEMA_DDL);
  });

  it('deve abrir o banco com nome customizado', () => {
    openSindiFlowDatabase('custom.db');
    expect(openDatabaseSync).toHaveBeenCalledWith('custom.db');
  });

  it('deve propagar erro quando a abertura do banco falha', () => {
    (openDatabaseSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Falha ao abrir SQLite');
    });

    expect(() => openSindiFlowDatabase()).toThrow('Falha ao abrir SQLite');
  });

  it('createSindiFlowExecutor deve retornar um ExpoSQLiteExecutor', () => {
    const executor = createSindiFlowExecutor();
    expect(executor).toBeInstanceOf(ExpoSQLiteExecutor);
  });
});
