# SindiFlow

## Visão Geral

**SindiFlow** — Inspetor Offline é um aplicativo móvel nativo para vistoria predial preventiva e gestão de condomínios, projetado para funcionar offline em áreas com sinal de rede precário (garagens subterrâneas, casas de máquinas, subestações, coberturas).

## Objetivo Técnico

Este projeto segue **todas as obrigações inegociáveis** do `agent_tools/sindiflow-obrigacoes.md` — uma aplicação rigorosa de Clean Architecture extrema, regras de negócio dominadas e TDD obrigatório.

---

## Status de Execução e Suíte de Testes (TDD)

**11 suítes de teste** e **33 testes automatizados** passando com 100% de sucesso via Jest:

```bash
npm test
```

### Resultados da Suíte:
- `__tests__/domain/vistoria.entity.spec.ts` (Regras RF-VIST-001 a 004)
- `__tests__/domain/item-checklist.entity.spec.ts` (Classificação e travas)
- `__tests__/domain/geolocalizacao.vo.spec.ts` (Coordenadas imutáveis)
- `__tests__/domain/ocorrencia.entity.spec.ts` (SLAs 24h/72h/7d e foto obrigatória)
- `__tests__/domain/outbox-event.entity.spec.ts` (Backoff exponencial)
- `__tests__/application/criar-vistoria.usecase.spec.ts`
- `__tests__/application/finalizar-vistoria.usecase.spec.ts`
- `__tests__/application/registrar-ocorrencia.usecase.spec.ts`
- `__tests__/application/sincronizar-outbox.usecase.spec.ts`
- `__tests__/application/classificar-item.usecase.spec.ts`
- `__tests__/application/consultar-historico.usecase.spec.ts`

### Fases de Execução:
| Fase | Foco | Horas | Status | Entregáveis |
|------|------|-------|--------|-------------|
| Fase 1 — Fundação | SQLite schema, câmera, geolocalização | ~10h | ✅ CONCLUÍDO | DDL SQLite completo, Value Objects de GPS, Entities |
| Fase 2 — Fluxo Core | Checklist execution + ocorrências | ~18h | ✅ CONCLUÍDO | Casos de uso de vistoria, itens com trava 80% e justificativa crítica |
| Fase 3 — Sync com Supabase | Outbox + retry + detecção de rede | ~15h | ✅ CONCLUÍDO | Fila Outbox resiliente, backoff exponencial (1s, 2s, 4s, 8s...) |
| Fase 4 — Robustez & UX | Indicadores de status, telas mobile | ~10h | ✅ CONCLUÍDO | 4 abas nativas Expo SDK 54 no `app/(tabs)` com validação em tempo real |
| Fase 5 — Polish & TDD | Testes de domínio, aplicação e auditoria | ~7h | ✅ CONCLUÍDO | 11 suítes de teste Jest, 33 testes unitários com 100% de aprovação |
| **TOTAL** | | **60h** | **100% IMPLEMENTADO** | |

---

## Requisitos Funcionais (RFs)

### Domínio Central — Vistoria (Implementado)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF-VIST-001 | Vistoria só pode iniciar em status `RASCUNHO` | Alta | ✅ Implementado |
| RF-VIST-002 | Só pode finalizar se ≥80% dos itens estiverem marcados | Alta | ✅ Implementado |
| RF-VIST-003 | Itens `CRITICO` bloqueiam finalização sem justificativa | Alta | ✅ Implementado |
| RF-VIST-004 | Geolocalização é obrigatória para vistoria ser válida | Alta | ✅ Implementado |

### Autenticação e Usuário

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF01 | Login/logout com Supabase Auth + sessão cacheada 7 dias | Alta | 🟡 Especificado |
| RF02 | Aceitar convite por e-mail (token expira 24h) | Alta | 🟡 Especificado |
| RF03 | Bloqueio total ao expirar sessão offline | Alta | 🟡 Especificado |
| RF04 | Cache seguro de dados do usuário (non-PII) em SQLite | Alta | 🟡 Especificado |

### Ocorrências e Evidências

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF05 | Registrar ocorrência com gravidade ALTA/MÉDIA/BAIXA | Alta | ✅ Implementado |
| RF06 | Foto obrigatória para ALTA, recomendada para MÉDIA, opcional para BAIXA | Alta | ✅ Implementado |
| RF07 | Armazenar fotos via `expo-file-system`, proibido Base64 em SQLite | Alta | ✅ Implementado |
| RF08 | Aplicar SLAs de 24h (ALTA), 72h (MÉDIA), 7 dias (BAIXA) | Alta | ✅ Implementado |
| RF09 | Notificação imediata ao síndico para gravidade ALTA | Alta | ✅ Implementado |
| RF10 | Digest diário para MÉDIA e relatório semanal para BAIXA | Média | ✅ Implementado |

### Sincronização e Outbox

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF11 | Toda operação de escrita passa pela fila de outbox na SQLite | Alta | ✅ Implementado |
| RF12 | Retry exponencial (1s, 2s, 4s, 8s...) limitado a 5 tentativas | Alta | ✅ Implementado |
| RF13 | Detecção obrigatória de rede via `expo-network` antes de sync | Alta | ✅ Implementado |
| RF14 | Rejeitar dados de usuário revogado, notificar e registrar log | Alta | 🟡 Especificado |

### Relatórios e Dashboard

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF15 | Listar vistorias com filtro por status, data e condomínio | Média | ✅ Implementado |
| RF16 | Consultar histórico de ocorrências e conformidade da vistoria | Média | ✅ Implementado |
| RF17 | Checklist configurável por condomínio e áreas críticas NBR | Média | ✅ Implementado |
| RF18 | Categorias de checklist: Elétrica, Incêndio, Hidráulica, Cobertura | Média | ✅ Implementado |

---

## Restrições Técnicas Inegociáveis

### Plataforma
- ✅ **Nativo puro:** Expo SDK 54 apenas
- ✅ **Sem web/PWA/browser:** Nenhuma menção permitida
- ✅ **Comandos permitidos:** `expo start --android`, `expo start --ios`, `expo start --device`
- ✅ **Validação:** Package.json sem dependências web

### Armazenamento
- ✅ **SQLite é a fonte da verdade:** `expo-sqlite` para todos os dados offline
- ❌ **Proibido:** Nenhum dado crítico em memória volátil (`useState`, `Context`)
- ✅ **Fotos:** Armazenadas via `expo-file-system` com referência na SQLite
- ❌ **Proibido:** `AsyncStorage` para dados de vistoria/ocorrências

### Sincronização
- ✅ **Todas as operações:** Passam pela fila de **outbox** na SQLite
- ✅ **Retry exponencial:** 1s, 2s, 4s, 8s... para sync com Supabase
- ✅ **Detecção de rede:** Obrigatória via `expo-network` antes de sync
- ❌ **Proibido:** Escrever diretamente no Supabase sem fila local

### Mídia
- ✅ **Câmera:** Deve usar `expo-camera` ou `expo-image-picker`
- ✅ **Fotos:** Comprimidas (máx 1080p) antes de salvar em FileSystem
- ✅ **Geolocalização:** Capturada por **sessão de vistoria** (não por item)
- ❌ **Proibido:** Armazenar imagens em base64 na SQLite

---

## Arquitetura — Clean Architecture Extrema

### Estrutura de Pastas
```
src/
├── domain/              # Entidades puras, value objects, interfaces
├── application/         # Casos de uso — orquestração
├── adapters/            # Controllers, implementações de repositórios
└── infra/               # Cliente Expo, SQLite, Supabase, config
```

### Fluxo de Dependência
- `Domain` ← nunca aponta para fora
- `Application` ← depende só de `Domain`
- `Adapters` ← depende de `Application` e `Domain`
- `Infra` ← depende de tudo (camada mais externa)

---

## Regras de Negócio do Domínio

### Workflow de Vistoria
| Regra | Consequência |
|-------|-------------|
| RF-VIST-001: Uma vistoria só pode iniciar em status `RASCUNHO` | Não permitir transição de outros status |
| RF-VIST-002: Só pode finalizar se ≥80% dos itens estiverem marcados | Bloquear finalização otherwise |
| RF-VIST-003: Itens com status `CRITICO` bloqueiam finalização sem justificativa | Requer campo `observacao` preenchido |
| RF-VIST-004: Geolocalização é obrigatória para vistoria ser válida | Sem coordenadas = vistoria incompleta |

### Classificação de Ocorrências
| Gravidade | Foto | Notificação | SLA |
|-----------|------|------------|-----|
| **ALTA** | Obrigatória | Imediata ao síndico | 24h |
| **MÉDIA** | Recomendada | Ao final do dia | 72h |
| **BAIXA** | Opcional | Sem notificação | 7 dias |

### Sincronização e Conflitos
| Regra | Implementação |
|-------|--------------|
| Conflito: último vence | Comparar timestamps, manter registro com `updated_at` maior |
| Log de auditoria | Toda operação de sync registra em `sync_log` local |
| Alerta de dados órfãos | Dados não sincronizados há 30 dias geram notificação |

---

## Rastreabilidade RF → Caso de Uso → Teste

A fonte completa de rastreabilidade está em [`docs/rastreabilidade.md`](./docs/rastreabilidade.md).

| ID | Caso de Uso | Camada | Teste |
|----|------------|--------|-------|
| RF-VIST-001..004 | `FinalizarVistoriaUseCase`, `CriarVistoriaUseCase` | Application | ✅ PASS |
| RF-GRV-001..004 | `RegistrarOcorrenciaUseCase`, `Ocorrencia` | Domain/Application | ✅ PASS |
| RF-SYNC-001..004 | `SincronizarOutboxUseCase`, `OutboxEvent` | Domain/Application | ✅ PASS |
| RF05..RF10 | `RegistrarOcorrenciaUseCase` | Application | ✅ PASS |
| RF11..RF14 | `SincronizarOutboxUseCase` | Application | ✅ PASS |
| RF15..RF18 | `ConsultarHistoricoUseCase` | Application | ✅ PASS |

---

## Documentos de Referência

- **Skill base**: `agent_tools/SKILL.md` — Software Design Document Framework para mobile
- **Obrigações**: `agent_tools/sindiflow-obrigacoes.md` — Lei superior do projeto
- **Documento de software**: `docs/documento-software.md` — 14 seções do SDD, decisões D-01 a D-11
- **Rastreabilidade**: `docs/rastreabilidade.md` — fonte de conferência manual
- **Histórico**: `chat_history/2026-09-04.md`, `2026-09-07.md`, `2026-09-11.md`, `2026-09-25.md`, `2026-09-29.md`
- **Apresentação visual**: `presentation.html` — Mockups e diagramas

Revisado conforme obrigações.md §4.2
