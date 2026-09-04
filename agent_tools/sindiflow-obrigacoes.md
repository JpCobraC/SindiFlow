---
name: sindiflow-obrigacoes
description: Skill obrigatória para o projeto SindiFlow — aplica todas as obrigações técnicas, regras de Clean Architecture extrema, domínios, regras de negócio, TDD, e o mecanismo de auto-correção obrigatório. Use esta skill em TODA interação relacionada ao projeto SindiFlow.
version: 1.0.0
date: 2026-09-04
---

# OBRIGAÇÕES DE DESENVOLVIMENTO — SINDFLOW v1.0

Esta skill contém todas as obrigações inegociáveis do projeto SindiFlow. **O agente DEVE aplicar estas regras em TODA interação, implementação, fala ou planejamento relacionado ao projeto.**

---

## 1. PRINCÍPIOS TÉCNICOS INEGOCIÁVEIS

### 1.1 PLATAFORMA
- ✅ O aplicativo **DEVE** ser 100% nativo usando **Expo SDK 54**
- ❌ **PROIBIDO**: qualquer menção a implementação web, PWA ou browser
- ✅ **PERMITIDO**: apenas `expo start --android`, `expo start --ios`, `expo start --device`
- ✅ **VALIDAÇÃO**: verificar `package.json` para ausência de dependências web

### 1.2 ARMAZENAMENTO
- ✅ **SQLite** (`expo-sqlite`) **É** a fonte da verdade para todos os dados offline
- ❌ Nenhum dado crítico pode existir apenas em memória volátil (`useState`, `Context`)
- ✅ Fotos **DEVEM** ser armazenadas via `expo-file-system` com referência na SQLite
- ❌ **PROIBIDO**: uso de `AsyncStorage` para dados de vistoria ou ocorrências

### 1.3 SINCRONIZAÇÃO
- ✅ Toda operação de escrita **DEVE** passar por fila de **outbox** na SQLite
- ✅ Sync com **Supabase** **DEVE** usar **retry exponencial** (1s, 2s, 4s, 8s...)
- ✅ Detecção de rede **OBRIGATÓRIA** via `expo-network` antes de toda tentativa de sync
- ❌ **PROIBIDO**: escrever diretamente no Supabase sem passar pela fila local

### 1.4 MÍDIA
- ✅ Câmera **DEVE** usar `expo-camera` ou `expo-image-picker`
- ✅ Fotos **DEVEM** ser comprimidas (máx 1080p) antes de salvar em FileSystem
- ✅ Geolocalização **DEVE** ser capturada por **sessão de vistoria** (não por item)
- ❌ **PROIBIDO**: armazenar imagens em base64 na SQLite

---

## 2. REGRAS DE CLEAN ARCHITECTURA EXTREMA

### 2.1 CAMADAS (ORDEM ESTRITA)

**Estrutura de pastas:**
```
src/
├── domain/              # Puro — entidades, value objects, interfaces
├── application/         # Use cases — orquestração
├── adapters/            # Controllers, repositories implementations
└── infra/               # Expo, SQLite, Supabase client, config
```

**Regras de dependência:**
- `Domain` ← nunca aponta para fora
- `Application` ← depende só de `Domain`
- `Adapters` ← depende de `Application` e `Domain`
- `Infra` ← depende de tudo (é a camada mais externa)

### 2.2 LIMITES DE RESPONSABILIDADE

| Camada | Responsabilidade | Dependências Permitidas |
|--------|-----------------|------------------------|
| **Domain** | Regras de negócio puras | Zero — isolamento total |
| **Application** | Orquestração de casos de uso | Interfaces do Domain |
| **Adapters** | Tradução entre use cases e frameworks | Interfaces do Domain, SDKs |
| **Infra** | Detalhes técnicos (conexões, drivers) | Bibliotecas externas |

### 2.3 VIOLAÇÕES GRAVES

❌ **EXEMPLO DE VIOLAÇÃO CRÍTICA:**
```typescript
// ❌ NUNCA FAÇA ISSO em src/application/ ou src/domain/
import { SQLite } from 'expo-sqlite'; // VIOLAÇÃO — lib de banco em camada errada
```

✅ **CORRETO:**
```typescript
// ✅ src/adapters/repositories/vistoria.repository.sqlite.ts
import { SQLite } from 'expo-sqlite';
import { VistoriaRepository } from '@/domain/interfaces/vistoria.repository.interface';

export class VistoriaRepositorySQLite implements VistoriaRepository {
  // implementação aqui
}
```

---

## 3. REGRAS DE NEGÓCIO DO DOMÍNIO

### 3.1 WORKFLOW DE VISTORIA

| Regra | Descrição | Consequência |
|-------|-----------|--------------|
| RF-VIST-001 | Uma vistoria só pode iniciar em status `RASCUNHO` | Não permitir transição de outros status |
| RF-VIST-002 | Só pode finalizar se ≥80% dos itens estiverem marcados | Bloquear finalização otherwise |
| RF-VIST-003 | Itens com status `CRITICO` bloqueiam finalização sem justificativa | Requer campo `observacao` preenchido |
| RF-VIST-004 | Geolocalização é obrigatória para vistoria ser válida | Sem coordenadas = vistoria incompleta |

### 3.2 CLASSIFICAÇÃO DE OCORRÊNCIAS

| Gravidade | Foto | Notificação | SLA |
|-----------|------|------------|-----|
| **ALTA** | Obrigatória | Imediata ao síndico | 24h |
| **MÉDIA** | Recomendada | Ao final do dia | 72h |
| **BAIXA** | Opcional | Sem notificação | 7 dias |

### 3.3 SINCRONIZAÇÃO E CONFLITOS

| Regra | Implementação |
|-------|--------------|
| Conflito: último vence | Comparar timestamps, manter registro com `updated_at` maior |
| Log de auditoria | Toda operação de sync registra em `sync_log` local |
| Alerta de dados órfãos | Dados não sincronizados há 30 dias geram notificação |

---

## 4. PROCESSOS DE DESENVOLVIMENTO

### 4.1 TDD OBRIGATÓRIO

**Ciclo vermelho-verde-refatoração:**

```
1. Escrever teste unitário de domínio (DEVE falhar)
2. Executar teste → ver falha (RED)
3. Escrever código mínimo para passar (GREEN)
4. Refatorar mantendo teste verde (REFACTOR)
5. Escrever teste de use case com fake repository
6. Teste de integração apenas para adapters (menos quantidade)
```

**Cobertura mínima:**
- Domain: ≥90%
- Application: ≥80%
- Adapters: cobertura de mapeamento

### 4.2 REVISÃO PRÉ-IMPLEMENTAÇÃO (SELF-CORRECTION LOOP)

⚠️ **ANTES DE ESCREVER QUALQUER CÓDIGO, O AGENTE DEVE:**

1. **Parar** e declarar: "Revisando obrigações §4.2..."
2. **Verificar** se a mudança viola alguma regra das seções 1-3
3. **Confirmar** que o teste unitário vem ANTES do código
4. **Declarar** a camada onde o código será escrito
5. **Explicar** como o código respeita as regras de negócio

**Frase obrigatória no commit:**
```
Revisado conforme obrigações.md §4.2
```

### 4.3 CHECKLIST PRÉ-COMMIT

- [ ] Verificado se não há dependências ilegais entre camadas
- [ ] Confirmado que todo RF tem teste de aceitação vinculado
- [ ] Assegurado que nenhum workaround foi usado
- [ ] Revisado o plano de implementação contra este documento
- [ ] Declarada a camada de Clean Architecture onde o código reside

---

## 5. AUTO-CORREÇÃO OBRIGATÓRIA

### 5.1 PERGUNTAS OBRIGATÓRIAS ANTES DE AÇÃO

Antes de **implementar**, **falar** ou **cogitar planejar**, o agente DEVE se perguntar:

| # | Pergunta | Se "SIM" → |
|---|----------|------------|
| 1 | Esta ação viola alguma obrigação listada neste documento? | Parar e revisar |
| 2 | Estou seguindo a ordem estrita das camadas? | Declarar camada no output |
| 3 | Este código poderia ser escrito em uma camada mais interna? | Mover camada interna |
| 4 | Há teste unitário para esta feature? | Escrever teste primeiro |
| 5 | Esta mudança afeta alguma regra de negócio? | Documentar e testar |

### 5.2 FLUXO DE AUTO-CORREÇÃO

```
┌─────────────────────────────────────────────────────────────┐
│  AGENTE IDENTIFICA OPÇÃO/IMPLEMENTAÇÃO                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SELF-CORRECTION CHECK (Obrigatório)                        │
│  "Esta ação viola alguma obrigação?"                        │
│  "Estou na camada correta?"                                │
│  "Há teste para isso?"                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
           "SIM"                      "NÃO"
              │                         │
              ▼                         ▼
┌────────────────────────┐    ┌────────────────────────────────┐
│  PARAR                  │    │  PROSSEGUIR                   │
│  Revisar obrigações     │    │  Implementar/Falar/Planejar   │
│  Identificar violação   │    │  Declarar camada no output     │
│  Propor correção        │    │  Incluir contexto de revisão   │
└────────────────────────┘    └────────────────────────────────┘
```

### 5.3 CONSEQUÊNCIAS DE VIOLAÇÃO

| Tipo de Violação | Consequência |
|-----------------|--------------|
| Dependência ilegal entre camadas | Reescrever código imediatamente |
| Ausência de teste unitário | Rejeitar PR até teste existir |
| Uso de workaround | Abrir issue para correção técnica |
| Violação de regra de negócio | Rollback + revisão arquitetural |

---

## 6. RASTREAMENTO DE REGRAS

| RF | Caso de Uso | Camada | Teste |
|----|------------|--------|-------|
| RF01 — Fazer Vistoria | UC01 | Application | ✅ Teste obrigatório |
| RF02 — Registrar Ocorrência | UC02 | Application | ✅ Teste obrigatório |
| RF03 — Consultar Histórico | UC03 | Application | ✅ Teste obrigatório |
| RF04 — Sincronizar Dados | UC04 | Application | ✅ Teste obrigatório |
| RF05 — Gerenciar Evidências | UC05 | Application | ✅ Teste obrigatório |
| RF06 — Registrar Geolocalização | UC06 | Application | ✅ Teste obrigatório |
| RF07 — Classificar Checklist | UC07 | Application | ✅ Teste obrigatório |

---

## 7. REFERÊNCIAS

- **Skill base**: `@skill_lazaro/SKILL.md` — Software Design Document Framework
- **Documento de arquitetura**: `docs/documento-software.md`
- **Histórico de planejamento**: `chat_history/2026-09-04.md`
- **Stack técnica**: Expo SDK 54, expo-router 6, React Native 0.81, SQLite, Supabase

---

## 8. ÚLTIMA REVISÃO

- **Data**: 04/09/2026
- **Versão**: 1.0.0
- **Próxima revisão**: Toda sexta-feira às 16h
- **Proposta de alteração**: Issue marcada como `[OBRIGAÇÃO]`, requiere aprovação de 2 arquitetos

---

*Este documento é a lei superior do projeto SindiFlow. Qualquer ação que viole estas obrigações deve ser corrigida imediatamente, sem exceção.*
