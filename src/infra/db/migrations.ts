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
export const SCHEMA_VERSION = 3;

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
  // Migration 1 → 2: tabelas comunicados, users e sync_log
  if (fromVersion < 2) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY NOT NULL,
        outbox_id TEXT,
        status TEXT NOT NULL,
        mensagem TEXT,
        executado_em TEXT NOT NULL,
        FOREIGN KEY (outbox_id) REFERENCES outbox_events(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_log_executado ON sync_log(executado_em);

      CREATE TABLE IF NOT EXISTS comunicados (
        id TEXT PRIMARY KEY NOT NULL,
        condominio_id TEXT NOT NULL,
        autor_id TEXT NOT NULL,
        autor_nome TEXT NOT NULL,
        titulo TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        data_criacao TEXT NOT NULL,
        fixado INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comunicados_condominio ON comunicados(condominio_id);

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK(role IN ('SINDICO', 'CONDOMINO', 'INSPETOR', 'ADMIN')),
        condominio_id TEXT NOT NULL,
        unidade TEXT,
        registro_profissional TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        ultimo_acesso TEXT,
        criado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_condominio ON users(condominio_id);
    `);
  }

  // Migration 2 → 3: status APROVADA/DEVOLVIDA no CHECK de vistorias + colunas
  // de metadados de aprovação/devolução (parecer, motivo, responsáveis, data).
  if (fromVersion < 3) {
    db.execSync(`
      DROP TABLE IF EXISTS vistorias_new;

      CREATE TABLE vistorias_new (
        id TEXT PRIMARY KEY NOT NULL,
        condominio_id TEXT NOT NULL,
        inspetor_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('RASCUNHO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA', 'APROVADA', 'DEVOLVIDA')),
        latitude REAL,
        longitude REAL,
        precisao REAL,
        data_criacao TEXT NOT NULL,
        data_finalizacao TEXT,
        parecer_tecnico TEXT,
        motivo_devolucao TEXT,
        devolvido_por TEXT,
        aprovado_por TEXT,
        data_aprovacao TEXT,
        updated_at TEXT NOT NULL
      );

      INSERT INTO vistorias_new (
        id, condominio_id, inspetor_id, status, latitude, longitude, precisao,
        data_criacao, data_finalizacao, updated_at
      )
      SELECT id, condominio_id, inspetor_id, status, latitude, longitude, precisao,
             data_criacao, data_finalizacao, updated_at
      FROM vistorias;

      DROP TABLE vistorias;
      ALTER TABLE vistorias_new RENAME TO vistorias;

      CREATE INDEX IF NOT EXISTS idx_vistorias_condominio ON vistorias(condominio_id);
      CREATE INDEX IF NOT EXISTS idx_vistorias_status ON vistorias(status);
      CREATE INDEX IF NOT EXISTS idx_vistorias_updated_at ON vistorias(updated_at);
    `);
  }
}
