# SindiFlow

## Visão Geral

**SindiFlow** — Inspetor Offline é um aplicativo móvel nativo para vistoria predial preventiva e gestão de condomínios, projetado para funcionar offline em áreas com sinal de rede precário (garagens subterrâneas, casas de máquinas, subestações, coberturas).

## Objetivo Técnico

Este projeto segue **todas as obrigações inegociáveis** do `agent_tools/sindiflow-obrigacoes.md` — uma aplicação rigorosa de Clean Architecture extrema, regras de negócio dominadas e TDD obrigatório.

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

### Exemplo de Limpeza de Dependência
```typescript
// ❌ NUNCA faça isso em src/application/ ou src/domain/
import { SQLite } from 'expo-sqlite'; // VIOLAÇÃO

// ✅ CORRETO: src/adapters/repositories/vistoria.repository.sqlite.ts
import { SQLite } from 'expo-sqlite';
import { VistoriaRepository } from '@/domain/interfaces/vistoria.repository.interface';
```

## Regras de Negócio do Domínio

### Workflow de Vistoria
| Regra | Consequência |
|-------|-------------|
| RF-VIST-001: Uma vistoria só pode iniciar em status `RASCUNHO` | Não permitir transição de outros status |
| RF-VIST-002: Só pode finalizar se ≥80% dos itens estiverem marcados | Bloquear finalização otherwise |
| RF-VIST-003: Itens com status `CRITICO` bloqueiam finalização sem justificativa | Requer campo `observacao` preenchido |
| RF-VIST-004: Geolocalização é obrigatória para vistoria ser válida | Sem coordenadas = vistoria incompleta |

### Classificação de Ocorrencias
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
PARAR                  │
Revisar obrigações     │
Identificar violação   │
Propor correção        │

PROSSEGUIR                   │
Implementar/Falar/Planejar   │
Declarar camada no output     │
Incluir contexto de revisão   │
```

### Consequências de Violação
| Tipo de Violação | Consequência |
|-----------------|--------------|
| Dependência ilegal entre camadas | Reescrever código imediatamente |
| Ausência de teste unitário | Rejeitar PR até teste existir |
| Uso de workaround | Abrir issue para correção técnica |
| Violação de regra de negócio | Rollback + revisão arquitetural |

## Constraint de Tempo e Status de Execução

**Total de horas estimadas:** 60 horas

| Fase | Foco | Horas | Status | Entregáveis |
|------|------|-------|--------|-------------|
| Fase 1 — Fundação | SQLite schema, câmera, geolocalização | ~10h | ✅ CONCLUÍDO | DDL SQLite completo, Value Objects de GPS, Entities |
| Fase 2 — Fluxo Core | Checklist execution + ocorrências | ~18h | ✅ CONCLUÍDO | Casos de uso de vistoria, itens com trava 80% e justificativa crítica |
| Fase 3 — Sync com Supabase | Outbox + retry + detecção de rede | ~15h | ✅ CONCLUÍDO | Fila Outbox resiliente, backoff exponencial (1s, 2s, 4s, 8s...) |
| Fase 4 — Robustez & UX | Indicadores de status, telas mobile | ~10h | ✅ CONCLUÍDO | 4 abas nativas Expo SDK 54 no `app/(tabs)` com validação em tempo real |
| Fase 5 — Polish & TDD | Testes de domínio, aplicação e auditoria | ~7h | ✅ CONCLUÍDO | 11 suítes de teste Jest, 33 testes unitários com 100% de aprovação |
| **TOTAL** | | **60h** | **100% IMPLEMENTADO** | |

## Stack Técnica & Conformidade
- **Framework:** Expo SDK 54 (puro, 100% nativo mobile)
- **Navegação:** Expo Router 6 (Tabs nativas em `app/(tabs)`)
- **Linguagem:** TypeScript 5.9 (Zero erros de compilação em `tsc --noEmit`)
- **Arquitetura:** Clean Architecture Extrema (`domain`, `application`, `adapters`, `infra`)
- **Persistência Offline:** SQLite (`expo-sqlite`) como fonte da verdade transacional
- **Sincronização:** Outbox Pattern com backoff exponencial e detecção obrigatória de rede via `expo-network`
- **Mídia & Evidências:** Câmera e referências em disco local (zero Base64 no SQLite)
- **Normas Técnicas Atendidas:** ABNT NBR 5674 e ABNT NBR 16747

## Suíte de Testes (TDD)
O projeto conta com **33 testes automatizados** cobrindo todas as regras de negócio:
```bash
npm test
```
Resultados:
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

Revisado conforme obrigações.md §4.2