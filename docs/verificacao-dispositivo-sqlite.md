# Checklist de Verificação SQLite em Dispositivo (C-15)

Este documento registra o que **DEVE** ser verificado em dispositivo real (iOS/Android)
antes de considerar a Fase 1 concluída. O `expo-sqlite` não roda sob Jest
(C-15), então a compatibilidade de SQL/DDL e o comportamento de runtime do
`ExpoSQLiteExecutor` só podem ser validados no aparelho.

## 1. Abertura de banco e migrações

- [ ] `openDatabaseSync('SindiFlow.db')` abre o banco sem erro
- [ ] `PRAGMA user_version` retorna 0 em banco novo
- [ ] Execução do DDL completo (`SQLITE_SCHEMA_DDL`) cria todas as 6 tabelas
- [ ] `PRAGMA user_version` é incrementado após migração
- [ ] Re-execução do DDL (`CREATE TABLE IF NOT EXISTS`) é idempotente

## 2. Tabela `outbox_events` e `chave_dedup` (RF-SYNC-007, C-16)

- [ ] Inserção com `chave_dedup` duplicada falha com erro de constraint único
- [ ] `CREATE UNIQUE INDEX idx_outbox_chave_dedup` existe e é efetivo
- [ ] Coalescer (UPDATE quando `chave_dedup` já existe) funciona via SQL
- [ ] Dois eventos legítimos sobre o mesmo registro não geram duplicata na fila

## 3. Índices

- [ ] `idx_outbox_chave_dedup` (único) criado
- [ ] `idx_outbox_status_tentativas` criado
- [ ] `idx_outbox_readiness` (status, data_ultima_tentativa, proximo_retry_ms) criado
- [ ] `idx_vistorias_condominio`, `idx_vistorias_status`, `idx_vistorias_updated_at` criados
- [ ] `idx_itens_vistoria`, `idx_itens_status` criados
- [ ] `idx_ocorrencias_vistoria`, `idx_ocorrencias_gravidade` criados
- [ ] `idx_fotos_item`, `idx_fotos_ocorrencia` criados
- [ ] `idx_sync_log_executado` criado

## 4. Tabela `sync_log` (§3.3)

- [ ] Tabela `sync_log` criada com FK para `outbox_events`
- [ ] Inserção de log de sync funciona
- [ ] `ON DELETE SET NULL` na FK `outbox_id` funciona

## 5. Tabela `fotos_evidencia` (RF-EVI-001, §1.4)

- [ ] `hash TEXT NOT NULL` — inserção sem hash falha
- [ ] Nenhuma imagem armazenada em base64 (apenas `caminho_arquivo`)
- [ ] FK para `itens_checklist` e `ocorrencias` funciona

## 6. Comportamento do `ExpoSQLiteExecutor`

- [ ] `executar()` devolve `alteracoes` correto para INSERT/UPDATE/DELETE
- [ ] `consultar()` devolve linhas tipadas corretamente
- [ ] `consultarUm()` devolve null quando não há linha
- [ ] `emTransacao()` faz commit quando a operação resolve
- [ ] `emTransacao()` faz rollback quando a operação lança
- [ ] `Date` não é passado como bind (conversão ISO feita pelo repositório)
- [ ] `Uint8Array`/`ArrayBuffer` não são usados como bind (proteção §1.4)

## 7. Dados de teste em dispositivo

- [ ] Inserir uma vistoria completa (vistorias + itens_checklist + outbox)
- [ ] Inserir uma ocorrência ALTA com foto (ocorrencias + fotos_evidencia + outbox)
- [ ] Simular ciclo de sync: enfileirar → processar → marcar sincronizado → descartar
- [ ] Verificar que `updated_at` é atualizado em cada escrita

## 8. Critério de aceitação

Todas as verificações acima devem passar em dispositivo real (iOS e Android) antes
de a Fase 1 ser considerada concluída. Qualquer falha bloqueia a entrega da Fase 1.

---

*Documento criado para resolver C-15. O `ExpoSQLiteExecutor` permanece sem teste de
runtime sob Jest (C-15); este checklist é a verificação alternativa em dispositivo.*
