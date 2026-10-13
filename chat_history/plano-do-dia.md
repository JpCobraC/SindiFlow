# Plano do Dia — SindiFlow

**Data:** 13/10/2026
**Fase executada:** Fase 0 (conformidade) + Fase 0.5, Blocos A e B (contratos e domínio)
**Não executado:** Bloco C, Fases 1 a 5 — o app segue mock
**Plano anterior:** `chat_history/plano-do-dia-2026-09-29.md` (arquivado, não aplicado por completo)

---

> ## ⚠️ O QUE ESTE PLANO **NÃO** COBRE
>
> Este arquivo registra o que foi **feito hoje**: Fase 0 e Fase 0.5 (Blocos A e B).
> **Todo o restante continua sem implementação.**
>
> | Etapa | Situação |
> |-------|----------|
> | Fase 0 — conformidade | ✅ feita |
> | Fase 0.5 · Bloco A (lotes 1–4) | ✅ feito |
> | Fase 0.5 · Bloco B (lotes 5–10) | ✅ feito |
> | Fase 0.5 · **Bloco C** (UX da auditoria) | ⬜ **não iniciado, nem definido como lote** |
> | **Fase 1** — `expo-sqlite` | ⬜ **não feita** |
> | **Fase 2** — gateways reais | ⬜ **não feita** |
> | **Fase 3** — Supabase | ⬜ **não feita** |
> | **Fase 4** — auth | ⬜ **não feita** |
> | **Fase 5** — notificações | ⬜ **não feita** |
>
> O app **continua mock**: persistência em `Map`, todos os gateways `*.fake.ts`,
> sem auth, sem Supabase. Nenhuma dependência nativa foi exercitada em dispositivo —
> os testes rodam em Node com fakes.

---

## 🎯 Objetivo do Dia

Deixar o projeto **auditável contra `sindiflow-obrigacoes.md`** antes de escrever a
primeira linha de infraestrutura real. Nenhuma regra de negócio muda nesta fase.

**Mudança de rumo:** a decisão **D-11** ("100% mock") foi **revogada** (D-12). A
apresentação era a razão de tudo estar em mock, e essa razão saiu. A partir de hoje os
`*.fake.ts` e `*.inmemory.ts` são **substituídos**, não preservados.

---

## 📋 Plano de Execução

Legenda: `✅ concluído · ⬜ não iniciado`

| # | Passo | Obrigação | Status |
|---|-------|-----------|--------|
| 0.1 | Instalar `expo-sqlite`, `expo-file-system`, `expo-network`, `expo-image-picker`, `expo-location`, `expo-secure-store`, `expo-crypto` + `jest-expo` + RNTL | §1.2–1.4 | ✅ |
| 0.2 | Baseline `npm test` antes de mexer em qualquer config | §4.1 | ✅ 15 suítes / 54 testes verdes |
| 0.3 | `jest.config.js`: 2 projects + `coverageThreshold` 90/80 | **T-01** | ✅ |
| 0.4 | Remover artefatos web | **T-03**, §1.1 | ✅ |
| 0.5 | Alinhar a lei ao Expo SDK 57 e registrar K-05 | §9 | ✅ lei v1.2.0 |
| 0.6 | Este arquivo | **§8** | ✅ |
| 0.7 | Resolver D-06 | §3.1, §3.2 | ✅ D-06 + D-12 |
| 0.8 | Corrigir `explore.tsx` | — | ✅ |
| 0.9 | `test` · `coverage` · `typecheck` · `lint` · `grep web` | §4.3 | ✅ |
| 0.10 | Relatório da sessão | §8 | ✅ `chat_history/2026-10-13.md` |

---

## Fase 0.5 — Bloco A e Bloco B ✅ concluídos (13/10/2026)

**Bloco A** (contratos e domínio) ✅ · **Bloco B** (lotes 5 a 10) ✅
**166 testes, 17 suítes, 4 gates verdes.** Resolve **C-01** e **C-05**.

| Lote | Conteúdo | Status |
|------|----------|--------|
| 1 | `OutboxEvent` como modelo único; `ItemOutbox` removido | ✅ |
| 2 | Backoff real: teto, `FALHA_MAXIMA` terminal, `resetar()`, filtro por prazo | ✅ |
| 3 | `sincronizarItem(): Promise<void>` + `ErroSincronizacao.transitorio` | ✅ |
| 4 | `Vistoria.finalizada` imutável (RF-VIST-007) | ✅ |
| 5 | GPS: `Number.isFinite` fecha o `NaN`; precisão configurável | ✅ |
| 6 | Imutabilidade: cópias defensivas, `Date` clonado, `resolver()` terminal | ✅ |
| 7 | §1.3: `CriarVistoria` e `AnexarFoto` enfileiram | ✅ |
| 8 | `expo-image-manipulator`; câmera discriminada; rede tri-estado | ✅ |
| 9 | DDL: `updated_at`, `hash`, `chave_dedup`, `data_ultima_tentativa` | ✅ |
| 10 | `src/adapters/` no gate (T-02); `presentation.html` movido; doc corrigida | ✅ |

### Correções de integridade do Bloco A (achadas por revisão adversarial)
- RF-VIST-007 era burlado na **reidratação** do banco: só `finalizar()` bloqueava os itens
- `resetar()` sem guarda apagava a assinatura §3.3 de um evento SINCRONIZADO
- `registrarFalha` aceitava evento nunca despachado e queimava tentativas
- `iniciarProcessamento()` saía da porta: com SQLite o `PROCESSANDO` nunca seria gravado
- Despacho concorrente abortava o lote e queimava tentativas (duplo toque no botão)
- Causa da falha silenciada após dead-letter

---

## 🚧 Bloqueios para a próxima sessão

| ID | Bloqueio | Resolve em |
|----|----------|------------|
| D-12 | **Todos os adapters são fake e toda persistência é `Map`.** Trocar as interfaces de repositório para `Promise` quebra as 15 suítes e os 8 use cases — esse é o RED inicial do TDD | **Fase 1** |
| Supabase | **Não existe projeto Supabase.** `chat_history/2026-09-07.md` registra "nada definido: URL, key, schema, RLS". A Fase 3 fica bloqueada | **Fase 3** |
| T-02 | Repositórios in-memory sem teste | ✅ resolvido na Fase 0.5 |
| C-01..C-09 | 9 cenários de sync/auth sem regra definida (`docs/documento-software.md` §1.6) | Fase 3 / Fase 4 |

---

## 📎 Próximas fases (planejadas, fora do escopo de hoje)

| Fase | Conteúdo | Obrigação |
|------|----------|-----------|
| **1** | `src/infra/db/` (open + migrations por `PRAGMA user_version`) e `src/adapters/repositories/*.sqlite.ts`. Interfaces viram `Promise` | §1.2 |
| **2** | Gateways reais: `expo-image-picker`, `expo-location` (por sessão, §1.4), `expo-network`, `expo-file-system` (`File`/`Paths`, **nunca base64**) | §1.3, §1.4 |
| **3** | `src/infra/supabase/`, retry exponencial usando a entidade `OutboxEvent` (hoje órfã), `sync_log`, last-write-wins com `updated_at` | §1.3, §3.3 |
| **4** | `Usuario` + sessão de 7 dias no `SecureStore`, convite por e-mail, aviso 1 dia antes, bloqueio total ao expirar | RF01–RF04 |
| **5** | Notificação imediata para ALTA e alerta de dados órfãos há 30 dias | §3.2, §3.3 |

---

*Criado em 13/10/2026. Fase 0 concluída no mesmo dia. O plano de 29/09/2026 foi arquivado em `plano-do-dia-2026-09-29.md` — conforme `sindiflow-obrigacoes.md` §8, plano não aplicado por completo não é deletado.*
