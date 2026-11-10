/**
 * SindiFlow — Migrations do SQLite
 * Camada: Infra (Frameworks & Drivers)
 *
 * Controla a versão do schema via `PRAGMA user_version`.
 * Cada migration é executada uma única vez, na abertura do banco.
 *
 * Conformidade com §1.2: migrations garantem que o schema esteja
 * sempre sincronizado com o domínio, sem perda de dados.
 */

import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Versão atual do schema. Incrementar a cada mudança estrutural no DDL.
 */
export const SCHEMA_VERSION = 1;

/**
 * Executa migrations pendentes no banco.
 *
 * Compara a versão armazenada em `PRAGMA user_version` com `SCHEMA_VERSION`.
 * Se o banco estiver desatualizado, aplica as migrations necessárias e
 * atualiza a versão.
 *
 * @param db handle do banco já aberto
 */
export function runMigrations(db: SQLiteDatabase): void {
  const currentVersion = getUserVersion(db);

  if (currentVersion < SCHEMA_VERSION) {
    applyMigrations(db, currentVersion);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/**
 * Lê a versão atual do schema armazenada no banco.
 */
function getUserVersion(db: SQLiteDatabase): number {
  const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  return result?.user_version ?? 0;
}

/**
 * Aplica migrations sequenciais da versão atual até a alvo.
 *
 * Adicionar novas migrations aqui como blocos condicionais por versão.
 */
function applyMigrations(db: SQLiteDatabase, fromVersion: number): void {
  // Migration 0 → 1: schema inicial já é criado pelo DDL em sqlite-connection.ts.
  // Nenhuma ação adicional necessária na versão 1.
  // Exemplo futuro:
  // if (fromVersion < 2) {
  //   db.execSync('ALTER TABLE vistorias ADD COLUMN nova_coluna TEXT');
  // }
}
