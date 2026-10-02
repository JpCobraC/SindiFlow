/**
 * SindiFlow — SQLite Schema & DDL
 * Camada: Infra (Frameworks & Drivers)
 * 
 * Fonte da verdade offline para o Expo SDK 54 usando expo-sqlite.
 * Conformidade com as Obrigações §1.2 e §1.3:
 * - Persistência estrita em SQLite (sem perda de dados)
 * - Fila de Outbox com controle de retry e auditoria
 * - Referências de fotos por caminho no FileSystem (sem base64)
 */

export const SQLITE_SCHEMA_DDL = `
-- 1. Tabela de Vistorias
CREATE TABLE IF NOT EXISTS vistorias (
  id TEXT PRIMARY KEY NOT NULL,
  condominio_id TEXT NOT NULL,
  inspetor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RASCUNHO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA')),
  latitude REAL,
  longitude REAL,
  precisao REAL,
  data_criacao TEXT NOT NULL,
  data_finalizacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_vistorias_condominio ON vistorias(condominio_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_status ON vistorias(status);

-- 2. Tabela de Itens de Checklist
CREATE TABLE IF NOT EXISTS itens_checklist (
  id TEXT PRIMARY KEY NOT NULL,
  vistoria_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE', 'OK', 'AVISO', 'CRITICO')),
  observacao TEXT,
  FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_itens_vistoria ON itens_checklist(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_itens_status ON itens_checklist(status);

-- 3. Tabela de Ocorrências / Chamados
CREATE TABLE IF NOT EXISTS ocorrencias (
  id TEXT PRIMARY KEY NOT NULL,
  vistoria_id TEXT NOT NULL,
  item_id TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  gravidade TEXT NOT NULL CHECK(gravidade IN ('BAIXA', 'MEDIA', 'ALTA')),
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK(status IN ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA')),
  sla_horas INTEGER NOT NULL,
  data_limite_sla TEXT NOT NULL,
  data_criacao TEXT NOT NULL,
  data_resolucao TEXT,
  solucao TEXT,
  FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES itens_checklist(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_vistoria ON ocorrencias(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_gravidade ON ocorrencias(gravidade);

-- 4. Tabela de Evidências Fotográficas (Apenas caminhos locais, NUNCA base64 §1.4)
CREATE TABLE IF NOT EXISTS fotos_evidencia (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT,
  ocorrencia_id TEXT,
  caminho_arquivo TEXT NOT NULL,
  resolucao TEXT,
  data_captura TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES itens_checklist(id) ON DELETE CASCADE,
  FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fotos_item ON fotos_evidencia(item_id);
CREATE INDEX IF NOT EXISTS idx_fotos_ocorrencia ON fotos_evidencia(ocorrencia_id);

-- 5. Tabela de Outbox (Fila de Sincronização Resiliente §1.3)
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY NOT NULL,
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL CHECK(operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  payload_json TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE', 'PROCESSANDO', 'SINCRONIZADO', 'FALHA_MAXIMA')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultimo_erro TEXT,
  proximo_retry_ms INTEGER NOT NULL DEFAULT 1000,
  data_criacao TEXT NOT NULL,
  data_sincronizacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_tentativas ON outbox_events(status, tentativas);

-- 6. Log de Auditoria de Sincronização (§3.3)
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY NOT NULL,
  outbox_id TEXT,
  status TEXT NOT NULL,
  mensagem TEXT,
  executado_em TEXT NOT NULL,
  FOREIGN KEY (outbox_id) REFERENCES outbox_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_log_executado ON sync_log(executado_em);
`;
