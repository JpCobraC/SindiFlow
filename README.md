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

| RF | Caso de Uso | Camada | Teste |
|----|------------|--------|-------|
| RF-VIST-001..004 | UC01 Fazer Vistoria, UC02 Finalizar Vistoria | Application | ✅ |
| RF01..RF04 | UC03 Autenticar Usuario | Application | ❌ |
| RF05..RF07 | UC04 Registrar Ocorrência | Application | ❌ |
| RF08..RF10 | UC05 SLA e Notificações | Application | ❌ |
| RF11..RF14 | UC06 Sincronizar Fila Pendente | Application | ❌ |
| RF15..RF16 | UC07 Consultar Histórico | Application | ❌ |
| RF17..RF18 | UC08 Gerenciar Checklist Template | Application | ❌ |

---

## Documentos de Referência

- **Skill base**: `@agent_tools/SKILL.md` — Software Design Document Framework para mobile
- **Obrigações**: `agent_tools/sindiflow-obrigacoes.md` — Lei superior do projeto
- **Histórico**: `chat_history/2026-09-04.md`, `2026-09-07.md`, `2026-09-11.md`, `2026-09-25.md`
- **Apresentação**: `presentation.html` — Mockups e diagramas visuais
- **Documento completo**: `docs/documento-software-mobile.md` (a ser gerado)

---

## Próximos Passos

1. **Completar RFs/RNFs** — Documentar regras pendentes antes de implementar
2. **Definir schema Supabase** — Tabelas, RLS policies, mapeamento SQLite↔Supabase
3. **Implementar infraestrutura** — Instalar dependências nativas, criar `src/infra/`
4. **Implementar domínio** — Entidades Usuario, Ocorrencia, FotoEvidencia, VOs
5. **Implementar use cases** — AutenticarUsuario, RegistrarOcorrencia, SincronizarFila
6. **Implementar adapters** — Repositórios SQLite, Gateways nativos
7. **Implementar UI** — Telas Expo Router integradas aos presenters

---

*Este documento é a fonte da verdade para requisitos do SindiFlow. Qualquer alteração deve seguir o loop de auto-correção (§4.2) e ser rastreada no `chat_history/`.*