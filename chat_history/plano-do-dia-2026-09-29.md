# Plano do Dia — SindiFlow

**Data:** 29/09/2026  
**Fase:** Domínio e Interface Primeiro (100% Mock / 80%+ Cobertura)

---

## 🎯 Objetivo do Dia

Completar a documentação de RFs/RNFs e implementar incrementalmente o domínio seguindo o checklist sequencial da presentation-06-10-26.md, com TDD obrigatório.

---

## 📋 Plano de Execução

**Ordem:** FASE 0 ✅ → FASE 1 ⬜ → FASE 2 ⬜ → FASE 3 ⬜ → FASE 4 ⬜ → FASE 5 ⬜

Legenda: `✅ concluído · 🟡 em andamento · ⬜ não iniciado`

**Nomenclatura vigente (D-01):** o Aggregate Root é `Vistoria`; não existe entidade `Ocorrencia`. Por isso, onde este plano diz `Ocorrencia`, vale `Vistoria`, e onde diz `RegistrarOcorrenciaUseCase`, vale `RegistrarVistoriaUseCase`.

### FASE 0: Documentação (Pré-Código)

**Arquivo:** `docs/documento-software.md`

**Ações:**
- [x] Adicionar RF08-RF18 (11 RFs) — migrados para o catálogo canônico do README
- [x] Adicionar RNF06-RNF08 (3 RNFs) — e renumerar os RNF anteriores para RNF09-RNF14, sem perda (mapa em §1.4)
- [x] Integrar regras de domínio (RF-VIST, RF-GRV, RF-SYNC) — e criar RF-EVI e RF-SEC
- [x] Mapear cada RF → Caso de Uso → Teste — `docs/rastreabilidade.md` (D-08)

**Status: ✅ CONCLUÍDA em 29/09/2026**

Entregue além do previsto na sessão:
- Decisões D-01 a D-11 registradas em `docs/documento-software.md` §0
- **D-06 pendente**: onde a gravidade mora (`ItemChecklist` ou `Vistoria`) — bloqueia o Passo 2
- 9 cenários sem regra definida (C-01..C-09) registrados como pendentes em §1.6, sem decisão inventada
- 3 pendências técnicas: T-01 `jest.config.js` sem `jest-expo`/`coverageThreshold` (bloqueia o Passo 1), T-02 repositórios in-memory sem teste, T-03 artefatos web do template violando `obrigacoes.md` §1.1
- Catálogo ampliado: 20 RF + 27 regras de domínio + 19 RNF, 15 casos de uso

**Bloqueios para a próxima sessão:** D-06 e T-01.

---

### FASE 1: Value Objects (Passo 1)

**TDD Obrigatório — Red-Green-Refactor**

| # | VO | Regras do Domínio | Testes | Status |
|---|----|-------------------|--------|--------|
| 1 | `Gravidade` | ALTA/MÉDIA/BAIXA + SLA (24h/72h/168h) + foto obrigatória (RF-GRV-001/002) | ≥90% | ⬜ |
| 2 | `Coordenada` | lat/lng + timestamp + precisão — substitui `Geolocalizacao` (RF-VIST-004) | ≥90% | ⬜ |
| 3 | `Assinatura` | token + timestamp, expiração 24h (RF02) | ≥90% | ⬜ |
| 4 | `SLAData` | validação horas totais/mínimas/período, base na abertura (RF-GRV-004) | ≥90% | ⬜ |
| 5 | `StatusSincronizacao` | pending/synced/error + agregado PARCIAL/TOTAL/COM_ERRO (RF-SYNC-009) | ≥90% | ⬜ |
| 6 | `StatusVistoria` | RASCUNHO/FINALIZADA/BLOQUEADA com regra de transição (RF-VIST-001) | ≥90% | ⬜ |

**Arquivos a criar:**
- `src/domain/value-objects/gravidade.vo.ts`
- `src/domain/value-objects/coordenada.vo.ts`
- `src/domain/value-objects/assinatura.vo.ts`
- `src/domain/value-objects/sla-data.vo.ts`
- `src/domain/value-objects/status-sincronizacao.vo.ts`
- `src/domain/value-objects/status-vistoria.vo.ts`

**Arquivos de teste:**
- `__tests__/domain/gravidade.vo.spec.ts`
- `__tests__/domain/coordenada.vo.spec.ts`
- `__tests__/domain/assinatura.vo.spec.ts`
- `__tests__/domain/sla-data.vo.spec.ts`
- `__tests__/domain/status-sincronizacao.vo.spec.ts`
- `__tests__/domain/status-vistoria.vo.spec.ts`

**Pré-requisito:** T-01 — `jest.config.js` precisa de `jest-expo` e `coverageThreshold` (Domain ≥90%) antes do primeiro teste.

**Removido:** `src/domain/value-objects/evidencia.vo.ts` (substituído por `FotoEvidencia` na FASE 2).

---

### FASE 2: Entities & Aggregates (Passo 2)

| # | Entity | Regras | Testes | Status |
|---|--------|--------|--------|--------|
| 1 | `Vistoria` (Aggregate Root) | RF-VIST-001..007, RF-GRV-002/006, RF-EVI-001, RF-SEC-001, RF-VIST-006 | ≥90% | 🟡 (4 regras testadas) |
| 2 | `Usuario` | Sessão 7 dias, revogação, perfis (RF19), RF-SYNC-004, RF-VIST-006 | ≥90% | ⬜ |
| 3 | `FotoEvidencia` | URI local/remota, hash, status upload, sem coordenada própria (§1.4), RF-EVI-001/002 | ≥90% | ⬜ |
| 4 | `ItemChecklist` | RF-VIST-003, categorias RF18 | ≥90% | 🟡 |

**Bloqueio:** D-06 — decidir se a gravidade mora no `ItemChecklist` ou na `Vistoria` antes de codar.

---

### FASE 3: Domain Services (Passo 3)

| # | Service | Regras | Testes | Status |
|---|---------|--------|--------|--------|
| 1 | `SincronizacaoService` | RF-SYNC-002/003/005/006/008/010, retry exponencial, idempotência, conflito | ≥90% | ⬜ |
| 2 | `RegraGeracaoRelatorioService` | RF-GRV-003/005, RF15 | ≥90% | ⬜ |
| 3 | `RegraDevolucaoService` | rollback de FINALIZADA para RASCUNHO | ≥90% | ⬜ |

**Cenários pendentes que affectam esta fase:** C-01, C-02, C-05, C-08.

---

### FASE 4: Interfaces (Passo 4)

| Interface | Tipo | Status |
|-----------|------|--------|
| `IVistoriaRepository` | Repository | ✅ (substitui `OcorrenciaRepository`) |
| `IFotoEvidenciaRepository` | Repository | ⬜ |
| `IItemChecklistRepository` | Repository | ⬜ |
| `IUsuarioRepository` | Repository | ⬜ |
| `ISessionStorage` | Port | ⬜ |
| `ICameraGateway` | Gateway | ⬜ |
| `ILocationGateway` | Gateway | ⬜ |
| `IAuthGateway` | Gateway | ⬜ |
| `ISyncGateway` | Gateway | ⬜ |

Já existentes: `IOutboxRepository` (precisa da chave de dedup, RF-SYNC-007) e `INetworkService`.

---

### FASE 5: Use Cases (Passo 5)

15 casos de uso (D-03), não 10. Rastreabilidade completa em `docs/rastreabilidade.md` §4.

| # | Use Case | RF | Testes | Status |
|---|----------|----|--------|--------|
| 1 | `RegistrarVistoriaUseCase` | RF05, RF17, RF18, RF20 | ≥80% | ⬜ (absorve `CriarVistoriaUseCase`) |
| 2 | `FinalizarVistoriaUseCase` | RF05, RF-VIST-002..004 | ≥80% | ✅ |
| 3 | `AnotarVistoriaUseCase` | RF17, RF18, RF-VIST-003 | ≥80% | ⬜ |
| 4 | `CapturarLocalizacaoUseCase` | RF06, RF-VIST-004 | ≥80% | ⬜ |
| 5 | `AnexarFotoUseCase` | RF06, RF07 | ≥80% | ⬜ |
| 6 | `SincronizarFilaUseCase` | RF11-RF14, RF09, RF10 | ≥80% | ⬜ |
| 7 | `GerarRelatorioUseCase` | RF08, RF15 | ≥80% | ⬜ |
| 8 | `AutenticarUsuarioUseCase` | RF01, RF03, RF04 | ≥80% | ⬜ |
| 9 | `AcessarViaTokenUseCase` | RF02 | ≥80% | ⬜ |
| 10 | `AvaliarDesempenhoUseCase` | RF08, RF10 | ≥80% | ⬜ |
| 11 | `RealizarAutoAvaliacaoUseCase` | RF17, RF18 | ≥80% | ⬜ |
| 12 | `AssinarVistoriaUseCase` | RF02 | ≥80% | ⬜ |
| 13 | `AprovarVistoriaUseCase` | RF19, RF15 | ≥80% | ⬜ |
| 14 | `DevolverVistoriaUseCase` | RF16 | ≥80% | ⬜ |
| 15 | `ConsultarHistoricoUseCase` | RF15, RF16, RF20 | ≥80% | ⬜ |

---

## 🎯 Critérios de Aceitação

| Métrica | Meta |
|---------|------|
| Cobertura Domínio | ≥90% |
| Cobertura Use Cases | ≥80% |
| Cobertura Context/Hooks | ≥80% |
| Cobertura Telas | ≥80% |
| Dados reais tocados | ZERO (100% mock) |
| TDD | Obrigatório (Red-Green-Refactor) |
| Commit message | "Revisado conforme obrigações.md §4.2" |

---

## 📊 Ordem de Execução

```
FASE 0: Docs ✅ → FASE 1: VOs ⬜ → FASE 2: Entities ⬜ → FASE 3: Services ⬜
       → FASE 4: Interfaces ⬜ → FASE 5: Use Cases ⬜ → FASE 6: Context ⬜
       → FASE 7: Telas ⬜ → FASE 8: Session (mock) ⬜
```

## 🚧 Bloqueios para a próxima sessão

| ID | Bloqueio | Resolve em |
|----|----------|------------|
| D-06 | Onde a gravidade mora: `ItemChecklist` ou `Vistoria` | FASE 2 |
| T-01 | `jest.config.js` precisa de `jest-expo` e `coverageThreshold` (90/80) para medir TDD | FASE 1 |
| T-02 | Repositórios in-memory sem teste | FASE 5 |
| T-03 | Artefatos web do template violam `obrigacoes.md` §1.1 | Adiada |

## 📎 Referências

- **Documento de software**: `docs/documento-software.md` (decisões D-01..D-11 em §0)
- **Rastreabilidade**: `docs/rastreabilidade.md` (regra → artefato → teste)
- **Plano da fase**: `chat_history/presentation-06-10-26.md`
- **Obrigações**: `agent_tools/sindiflow-obrigacoes.md`

---

*Documento criado em 29/09/2026. FASE 0 concluída em 29/09/2026; FASE 1 a 5 permanecem em aberto. Conforme `obrigacoes.md` §8, plano não aplicado por completo → preservado.*