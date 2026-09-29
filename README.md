# SindiFlow

## Visão Geral

**SindiFlow** — Inspetor Offline é um aplicativo móvel nativo para vistoria predial preventiva e gestão de condomínios, projetado para funcionar offline em áreas com sinal de rede precário (garagens subterrâneas, casas de máquinas, subestações, coberturas).

## Objetivo Técnico

Este projeto segue **todas as obrigações inegociáveis** do `agent_tools/sindiflow-obrigacoes.md` — uma aplicação rigorosa de Clean Architecture extrema, regras de negócio dominadas e TDD obrigatório.

---

## Requisitos Funcionais (RFs)

### Domínio Central — Vistoria (Implementado)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF-VIST-001 | Vistoria só pode iniciar em status `RASCUNHO` | Alta | ✅ Implementado |
| RF-VIST-002 | Só pode finalizar se ≥80% dos itens estiverem marcados | Alta | ✅ Implementado |
| RF-VIST-003 | Itens `CRITICO` bloqueiam finalização sem justificativa | Alta | ✅ Implementado |
| RF-VIST-004 | Geolocalização é obrigatória para vistoria ser válida | Alta | ✅ Implementado |

### Autenticação e Usuário (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF01 | Login/logout com Supabase Auth + sessão cacheada 7 dias | Alta | ❌ Pendente |
| RF02 | Aceitar convite por e-mail (token expira 24h) | Alta | ❌ Pendente |
| RF03 | Bloqueio total ao expirar sessão offline | Alta | ❌ Pendente |
| RF04 | Cache seguro de dados do usuário (non-PII) em SQLite | Alta | ❌ Pendente |

### Ocorrências e Evidências (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF05 | Registrar ocorrência com gravidade ALTA/MÉDIA/BAIXA | Alta | ❌ Pendente |
| RF06 | Foto obrigatória para ALTA, recomendada MÉDIA, opcional BAIXA | Alta | ❌ Pendente |
| RF07 | Compressão de imagem (máx 1080p) + storage em FileSystem | Alta | ❌ Pendente |
| RF08 | SLA ALTA 24h / MÉDIA 72h / BAIXA 7 dias | Média | ❌ Pendente |
| RF09 | Notificação imediata ao síndico para ALTA | Média | ❌ Pendente |
| RF10 | Digest diário MÉDIA, sem notificação BAIXA | Baixa | ❌ Pendente |

### Sincronização e Outbox (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF11 | Fila outbox persistente em SQLite | Alta | ❌ Pendente |
| RF12 | Retry exponencial com limite máximo de tentativas (5) | Alta | ❌ Pendente |
| RF13 | Detecção de rede via `expo-network` antes de sync | Alta | ❌ Pendente |
| RF14 | Rejeitar sync de usuário revogado (notificar + log) | Alta | ❌ Pendente |

### Consulta e Histórico (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF15 | Listar vistorias com filtro por status/data/condomínio | Média | ❌ Pendente |
| RF16 | Consultar histórico de ocorrências de uma vistoria | Média | ❌ Pendente |

### Checklist Template (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF17 | Checklist template: fixo ou configurável por condomínio | Média | ❌ Pendente |
| RF18 | Categorias de itens: Elétrica, Incêndio, Hidráulica | Média | ❌ Pendente |

### Perfis, Permissões e Armazenamento (Pendente)

| ID | Descrição | Prioridade | Status |
|----|-----------|------------|--------|
| RF19 | Matriz de perfis e permissões (síndico/zelador/administrador) sobre criar, finalizar, aprovar, devolver e consultar vistorias | Alta | ❌ Pendente |
| RF20 | Limite de espaço local e política de limpeza de dados (o que sai primeiro: mídia sincronizada, depois rascunhos) | Média | ❌ Pendente |

> RF19 e RF20 foram acrescentados na Fase 0 (29/09/2026) para fechar as lacunas 3 e 11 apontadas em `chat_history/2026-09-25.md`. Definição completa em `docs/documento-software.md` §1.1.

---

## Regras de Negócio do Domínio (com código)

O detalhamento completo está em `docs/documento-software.md` §1.2 — 27 regras, cada uma com obrigação de origem, Passo e prioridade P1/P2.

### Gravidade, Evidência e SLA

| ID | Regra | Origem | Status |
|----|-------|--------|--------|
| RF-GRV-001 | Gravidade ALTA 24h · MÉDIA 72h · BAIXA 168h | `obrigacoes.md` §3.2, RF08 | ⬜ |
| RF-GRV-002 | Foto obrigatória ALTA, recomendada MÉDIA, opcional BAIXA | `obrigacoes.md` §3.2, RF06 | ⬜ |
| RF-GRV-003 | ALTA notifica o síndico na hora; MÉDIA em digest diário; BAIXA não notifica | `obrigacoes.md` §3.2, RF09, RF10 | ⬜ |
| RF-GRV-004 | SLA em dias corridos, contados da abertura do achado | — | ⬜ |
| RF-GRV-005 | Violação de SLA escala ao síndico | — | ⬜ (P2) |
| RF-GRV-006 | Gravidade pode ser reclassificada, com trilha e recálculo de SLA | — | ⬜ (P2) |
| RF-EVI-001 | Evidência exige hash e arquivo local presente para exibir offline | `obrigacoes.md` §1.4 | ⬜ |
| RF-EVI-002 | Mesmo hash ocupa um arquivo; há limite de fotos por vistoria | `obrigacoes.md` §1.2, RF20 | ⬜ (P2) |

### Sincronização

| ID | Regra | Origem | Status |
|----|-------|--------|--------|
| RF-SYNC-001 | Toda escrita passa pela fila de outbox | `obrigacoes.md` §1.3, RF11 | 🟡 |
| RF-SYNC-002 | Retry exponencial 1s, 2s, 4s, 8s, 16s — máx. 5 tentativas | `obrigacoes.md` §1.3, RF12 | ⬜ |
| RF-SYNC-003 | Rede verificada antes de qualquer tentativa | `obrigacoes.md` §1.3, RF13 | 🟡 |
| RF-SYNC-004 | Sync de usuário revogado é rejeitado, com log | `obrigacoes.md` §1.3, RF14 | ⬜ |
| RF-SYNC-005 | Conflito: vence o `updated_at` maior | `obrigacoes.md` §3.3 | ⬜ |
| RF-SYNC-006 | Log de auditoria por sync; alerta de órfãos em 30 dias | `obrigacoes.md` §3.3 | ⬜ |
| RF-SYNC-007 | Chave de deduplicação: reenvio nunca duplica registro | — | ⬜ |
| RF-SYNC-008 | Envio FIFO respeitando FK usuário → vistoria → item → evidência | — | ⬜ |
| RF-SYNC-009 | Status agregado por vistoria: PARCIAL / TOTAL / COM_ERRO | RNF08 | ⬜ |
| RF-SYNC-010 | Relógio do dispositivo não altera o desempate | — | ⬜ |

### Segurança

| ID | Regra | Origem | Status |
|----|-------|--------|--------|
| RF-SEC-001 | Remover registro apaga mídia e itens pendentes da outbox | RNF14 | ⬜ |
| RF-SEC-002 | Trilha de auditoria append-only | `obrigacoes.md` §3.3 | ⬜ (P2) |

---

## Requisitos Não-Funcionais (RNFs)

| ID | Categoria | Descrição + Critério Mensurável | Prioridade | Status |
|----|-----------|--------------------------------|------------|--------|
| RNF01 | Offline-first | Quais telas/ações funcionam sem rede; o que fica bloqueado | Alta | ❌ Não documentado |
| RNF02 | Permissões de dispositivo | Momento de solicitar câmera/GPS (nunca cold start); comportamento se negada | Alta | ❌ Ausente |
| RNF03 | Uso de bateria/dados | Frequência GPS, compressão de imagem antes de upload | Média | ❌ Ausente |
| RNF04 | Armazenamento local | Limite de espaço em disco (mídia + SQLite), política de limpeza de dados sincronizados antigos | Média | ❌ Ausente |
| RNF05 | Sincronização/consistência | Last-write-wins por `updated_at`, tolerância a duplicidade | Alta | ⚠️ Decisão, não codificada |
| RNF06 | Segurança | Token em `expo-secure-store` (nunca AsyncStorage), RLS Supabase documentado | Alta | ⚠️ Parcial |
| RNF07 | Compatibilidade | Versões mínimas iOS/Android suportadas | Média | ❌ Ausente |
| RNF08 | Usabilidade | Feedback visual de estado de sync (pendente/sincronizado/erro) visível ao usuário | Alta | ⚠️ Mockup |

### RNFs novos (Fase 0, 29/09/2026)

| ID | Categoria | Descrição + Critério Mensurável | Prioridade | Status |
|----|-----------|--------------------------------|------------|--------|
| RNF15 | Eficiência energética | Sync automático apenas com Wi-Fi ou com o dispositivo carregando; caso contrário, apenas manual | Alta | ❌ Ausente |
| RNF16 | Concorrência | Alteração concorrente do mesmo registro é detectada e o usuário é avisado; nada é sobrescrito em silêncio | Média | ❌ Ausente |
| RNF17 | Acessibilidade | Alvo de toque ≥ 44pt, texto escalável, operação completa sem depender de cor | Média | ❌ Ausente |
| RNF18 | Observabilidade | Log local com data/rota/erro e zero PII (e-mail, token, coordenada) | Média | ❌ Ausente |
| RNF19 | Testabilidade | `src/domain/**` e `src/application/**` com zero import de React/Expo/SDK | Alta | ❌ Ausente |

> RNF01-RNF14 acima usam a numeração do documento de software. A coluna "ID anterior" em `docs/documento-software.md` §1.3 preserva o vínculo com a numeração original, evitando requisito duplicado.

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

### Limites de Responsabilidade
| Camada | Responsabilidade | Dependências Permitidas |
|--------|-----------------|------------------------|
| **Domain** | Regras de negócio puras | Zero — isolamento total |
| **Application** | Orquestração de casos de uso | Interfaces do Domain |
| **Adapters** | Tradução entre use cases e frameworks | Interfaces do Domain, SDKs |
| **Infra** | Detalhes técnicos (conexões, drivers) | Bibliotecas externas |

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

## Processo de Desenvolvimento

### TDD Obrigatório
**Ciclo vermelho-verde-refatoração:**
1. Escrever teste unitário de domínio (DEVE falhar)
2. Executar teste → ver falha (RED)
3. Escrever código mínimo para passar (GREEN)
4. Refatorar mantendo teste verde (REFACTOR)
5. Escrever teste de use case com fake repository
6. Teste de integração apenas para adapters

**Cobertura mínima:**
- Domain: ≥90%
- Application: ≥80%
- Adapters: cobertura de mapeamento

### Revisão Pré-implementação
ANTES de escrever qualquer código, parar e declarar: *"Revisando obrigações §4.2..."*
1. Verificar se a mudança viola alguma regra das seções 1-3
2. Confirmar que o teste unitário vem ANTES do código
3. Declarar a camada onde o código será escrito
4. Explicar como o código respeita as regras de negócio

**Frase obrigatória no commit:**
```
Revisado conforme obrigações.md §4.2
```

---

## Auto-correção Obrigatória

### Loop de Self-correction
```
AGENTE IDENTIFICA OPÇÃO/IMPLEMENTAÇÃO
                     │
                     ▼
SELF-CORRECTION CHECK (Obrigatório)
"Esta ação viola alguma obrigação?"
"Estou na camada correta?"
"Há teste para isso?"

                  ┌────────────┴────────────┐
                  │                         │
               "SIM"                      "NÃO"
                  │                         │
                  ▼                         ▼
PARAR                  PROSSEGUIR
Revisar obrigações     Implementar/Falar/Planejar
Identificar violação   Declarar camada no output
Propor correção        Incluir contexto de revisão
```

### Consequências de Violação
| Tipo de Violação | Consequência |
|-----------------|--------------|
| Dependência ilegal entre camadas | Reescrever código imediatamente |
| Ausência de teste unitário | Rejeitar PR até teste existir |
| Uso de workaround | Abrir issue para correção técnica |
| Violação de regra de negócio | Rollback + revisão arquitetural |

---

## Constraint de Tempo

**Total de horas disponíveis:** 60 horas

| Fase | Foco | Estimativa de Horas |
|------|------|-------------------|
| Fase 1 — Fundação | SQLite schema, câmera, geolocalização | ~10h |
| Fase 2 — Fluxo Core | Checklist execution + evidências | ~18h |
| Fase 3 — Sync com Supabase | Outbox + retry + detecção de rede | ~15h |
| Fase 4 — Robustez & UX | Indicadores de status, tratamento de erros | ~10h |
| Fase 5 — Polish | Transições, haptics, testes em device real | ~7h |
| **TOTAL** | | **60h** |

---

## Stack Técnica
- Expo SDK 54
- Expo Router 6
- React Native 0.81
- TypeScript
- SQLite (expo-sqlite)
- Supabase (@supabase/supabase-js)
- Expo Camera / Image Picker
- Expo Location
- Expo Network
- Expo File System

---

## Rastreabilidade RF → Caso de Uso → Teste

A fonte completa e conferível manualmente — cada regra com artefato de código, arquivo de teste, Passo e prioridade — está em [`docs/rastreabilidade.md`](./docs/rastreabilidade.md).

| ID | Caso de Uso | Camada | Teste |
|----|------------|--------|-------|
| RF-VIST-001..004 | `FinalizarVistoriaUseCase`, `AnotarVistoriaUseCase` | Application | ✅ |
| RF-VIST-005..007 | `RegistrarVistoriaUseCase` | Application | ❌ |
| RF-GRV-001..004 | `RegistrarVistoriaUseCase`, `AnexarFotoUseCase`, `GerarRelatorioUseCase` | Domain | ❌ |
| RF-GRV-005..006 | `RegraGeracaoRelatorioService` | Domain | ❌ |
| RF-SYNC-001 | todos os use cases de escrita | Application | 🟡 |
| RF-SYNC-002..010 | `SincronizarFilaUseCase` | Application | ❌ |
| RF-EVI-001..002 | `AnexarFotoUseCase` | Domain | ❌ |
| RF-SEC-001..002 | `AutenticarUsuarioUseCase`, `SincronizarFilaUseCase` | Domain | ❌ |
| RF01..RF04 | `AutenticarUsuarioUseCase` | Application | ❌ |
| RF05..RF07 | `RegistrarVistoriaUseCase`, `AnexarFotoUseCase` | Application | ❌ |
| RF08..RF10 | `GerarRelatorioUseCase`, `AvaliarDesempenhoUseCase` | Application | ❌ |
| RF11..RF14 | `SincronizarFilaUseCase` | Application | ❌ |
| RF15..RF16 | `ConsultarHistoricoUseCase`, `GerarRelatorioUseCase` | Application | ❌ |
| RF17..RF18 | `RealizarAutoAvaliacaoUseCase` | Application | ❌ |
| RF19 | `AprovarVistoriaUseCase` | Domain | ❌ |
| RF20 | `RegistrarVistoriaUseCase` | Domain | ❌ |

Legenda: `⬜ não iniciado · 🟡 parcial · ✅ implementado com teste · ⛔ bloqueado`

---

## Documentos de Referência

- **Skill base**: `agent_tools/SKILL.md` — Software Design Document Framework para mobile
- **Obrigações**: `agent_tools/sindiflow-obrigacoes.md` — Lei superior do projeto
- **Documento de software**: `docs/documento-software.md` — 14 seções do SDD, decisões D-01 a D-11
- **Rastreabilidade**: `docs/rastreabilidade.md` — fonte de conferência manual
- **Histórico**: `chat_history/2026-09-04.md`, `2026-09-07.md`, `2026-09-11.md`, `2026-09-25.md`, `2026-09-29.md`
- **Plano da fase**: `chat_history/presentation-06-10-26.md` (documento da sessão de 06/10)
- **Apresentação visual**: `presentation.html` — Mockups e diagramas

---

## Próximos Passos

Os Passos 1 a 8 de `chat_history/presentation-06-10-26.md` §7, nesta ordem:

1. **Passo 1 — Value Objects** — `Gravidade`, `Coordenada`, `Assinatura`, `SLAData`, `StatusSincronizacao`, `StatusVistoria`
2. **Passo 2 — Entities & Aggregates** — expandir `Vistoria` (Aggregate Root), criar `Usuario` e `FotoEvidencia`
3. **Passo 3 — Domain Services** — `SincronizacaoService`, `RegraGeracaoRelatorioService`, `RegraDevolucaoService`
4. **Passo 4 — Ports** — repositories e gateways (todos fake/in-memory nesta fase)
5. **Passo 5 — Use Cases** — os 15 casos de uso com fakes in-memory
6. **Passo 6 — Context API + Hooks** — `AuthContext`, `useAuth`, `useOcorrencias`
7. **Passo 7 — Telas com RNTL** — Login, VistoriaForm, HistoricoRelatorios, Assinatura, Dashboard
8. **Passo 8 — Sessão Segura** — `SessionStorageSecureStore` (mockado nos testes)

Bloqueios conhecidos antes do Passo 1: **D-06** (onde a gravidade mora) e **T-01** (`jest.config.js` sem `jest-expo` nem `coverageThreshold`).

Depois da fase: definir schema Supabase com RLS, criar `src/infra/`, instalar dependências nativas e substituir fakes por implementações reais.

---

*Este documento é a fonte da verdade para requisitos do SindiFlow. Qualquer alteração deve seguir o loop de auto-correção (§4.2) e ser rastreada no `chat_history/`.*