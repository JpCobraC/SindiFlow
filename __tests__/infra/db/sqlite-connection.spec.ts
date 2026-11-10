/**
 * Testes para sqlite-connection.ts
 *
 * Como `expo-sqlite` não roda sob Jest (C-15), mockamos o módulo e
 * testamos a lógica de abertura do banco e execução do DDL.
 */
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

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { openSindiFlowDatabase } from '../../src/infra/db/sqlite-connection';
import { SQLITE_SCHEMA_DDL } from '../../src/infra/db/sqlite-schema';

const mockExecSync = (openDatabaseSync as jest.Mock).mock.results?.[0]?.value?.execSync;

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

  it('deve retornar uma instância de SQLiteDatabase', () => {
    const db = openSindiFlowDatabase();
    expect(db).toBeDefined();
    expect(typeof db.execSync).toBe('function');
  });
});
