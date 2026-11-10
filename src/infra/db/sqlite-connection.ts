/**
 * SindiFlow — Conexão com SQLite
 * Camada: Infra (Frameworks & Drivers)
 *
 * Abre o banco local com `openDatabaseSync` do `expo-sqlite` e executa
 * o DDL completo (sqlite-schema.ts). É o ponto único de abertura do banco.
 *
 * Conformidade com §1.2: SQLite é a fonte da verdade offline.
 * Toda escrita feita pelos repositórios SQLite passa por esta conexão.
 */

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { SQLITE_SCHEMA_DDL } from './sqlite-schema';
import { ExpoSQLiteExecutor } from './expo-sqlite.executor';

/**
 * Abre (ou cria) o banco SindiFlow e executa o DDL completo.
 *
 * @param databaseName nome do arquivo de banco (padrão: 'sindiflow.db')
 * @returns handle do `SQLiteDatabase` já com o schema aplicado
 */
export function openSindiFlowDatabase(
  databaseName: string = 'sindiflow.db'
): SQLiteDatabase {
  const db = openDatabaseSync(databaseName);
  db.execSync(SQLITE_SCHEMA_DDL);
  return db;
}

/**
 * Cria um `ExpoSQLiteExecutor` conectado ao banco SindiFlow.
 * Útil para injeção de dependência nos repositórios SQLite.
 *
 * @param databaseName nome do arquivo de banco (padrão: 'sindiflow.db')
 * @returns executor pronto para uso pelos repositórios
 */
export function createSindiFlowExecutor(
  databaseName: string = 'sindiflow.db'
): ExpoSQLiteExecutor {
  const db = openSindiFlowDatabase(databaseName);
  return new ExpoSQLiteExecutor(db);
}
