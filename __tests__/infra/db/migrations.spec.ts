/**
 * Testes para migrations.ts
 *
 * Testa a leitura e escrita de PRAGMA user_version, que é a
 * estratégia de versionamento do schema do SQLite.
 */
jest.mock('expo-sqlite', () => {
  let userVersion = 0;
  return {
    openDatabaseSync: jest.fn(() => ({
      execSync: jest.fn((sql: string) => {
        if (sql.startsWith('PRAGMA user_version =')) {
          userVersion = parseInt(sql.split('=')[1].trim(), 10);
        }
      }),
      getFirstSync: jest.fn(() => ({ user_version: userVersion })),
    })),
  };
});

import { openDatabaseSync } from 'expo-sqlite';
import { runMigrations, SCHEMA_VERSION } from '../../src/infra/db/migrations';

describe('runMigrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve definir SCHEMA_VERSION como 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('deve aplicar migration quando o banco está na versão 0', () => {
    const db = openDatabaseSync('test.db');
    runMigrations(db);
    const execSync = (db as any).execSync;
    expect(execSync).toHaveBeenCalledWith(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });

  it('não deve reapply migration quando já está na versão atual', () => {
    // Simular banco já na versão 1
    const db = openDatabaseSync('test.db');
    (db as any).getFirstSync = jest.fn(() => ({ user_version: 1 }));
    runMigrations(db);
    const execSync = (db as any).execSync;
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('PRAGMA user_version')
    );
  });
});
