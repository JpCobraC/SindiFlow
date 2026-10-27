# Plano do Dia — SindiFlow

> ## Sessão de 27/10/2026 — Fase 1, passo 2b (repositórios SQLite de escrita) + ressalvas
>
> O conteúdo de 16/10 e 13/10 abaixo foi **preservado**, não substituído: por §8.2b um
> plano não aplicado por completo não é deletado, e as Fases 2 a 5 continuam pendentes.
>
> **Decisões do responsável:** C-16 → coalescer ("último vence", §3.3) · C-17 →
> `src/infra/db/expo-sqlite.executor.ts` em `coveragePathIgnorePatterns` com comentário
> vinculando C-15 · C-14 → `react@19.3.1` + `@testing-library/react-native@12.9.0`.
>
> ### Etapa A — Ressalvas (concluídas)
>
> | # | Passo | Status |
> |---|-------|--------|
> | A.1 | C-14: `react` atualizado para 19.3.1 + RNTL 12.9.0 instalado | ✅ |
> | A.2 | C-17: `expo-sqlite.executor.ts` em `coveragePathIgnorePatterns` | ✅ |
> | A.3 | C-15: Checklist de dispositivo criado (`docs/verificacao-dispositivo-sqlite.md`) | ✅ |
> | A.4 | Gates verdes após alterações: 221 testes, 21 suítes | ✅ |
>
> ### Etapa B — RF-VIST-001 guarda (C-10) — TDD, domain
>
> | # | Passo | Status |
> |---|-------|--------|
> | B.1 | `VistoriaStatusInvalidoError` adicionado a `domain-errors.ts` | ✅ |
> | B.2 | `Vistoria.criar()` recusa status ≠ RASCUNHO | ✅ |
> | B.3 | `Vistoria.reidratar()` permite qualquer status (hidratação do banco) | ✅ |
> | B.4 | Testes de reidratação migrados de `criar` para `reidratar` | ✅ |
> | B.5 | 3 novos testes RF-VIST-001 | ✅ RED → GREEN |
>
> ### Etapa C — Passo 2b: repositórios SQLite de escrita — TDD, adapters
>
> | # | Passo | Status |
> |---|-------|--------|
> | C.1 | `OutboxRepositorySQLite` + spec (20 testes) | ✅ RED → GREEN |
> | C.2 | `VistoriaRepositorySQLite` + spec (9 testes) | ✅ RED → GREEN |
> | C.3 | `OcorrenciaRepositorySQLite` + spec (8 testes) | ✅ RED → GREEN |
> | C.4 | `Ocorrencia.reidratar()` adicionado; validações movidas de construtor para `criar` | ✅ |
> | C.5 | Gates verdes finais: 258 testes, 24 suítes, lint limpo, typecheck OK | ✅ |
>
> **Camadas respeitadas (§2.1):** `domain` puro (zero `expo-*`) → `application` (só
> interfaces de domain) → `adapters` (repositórios sobre `ISQLiteExecutor`) →
> `infra` (`ExpoSQLiteExecutor` com `expo-sqlite`). `Date` → ISO string antes de
> `SqlParam` (§1.4).
>
> **Nenhum threshold relaxado. Nenhum `eslint-disable`.**
>
> **Próximo bloqueio:** C-16 já decidido (coalescer). C-15 exige verificação em
> dispositivo (checklist em `docs/`). C-12 (RF-EVI-001 "arquivo local presente")
> pertence à Fase 2.
>
> > ---
>
> ## Sessão de 16/10/2026 — procedimento de correção (aplicado)
>
> O conteúdo de 13/10 abaixo foi **preservado**, não substituído: por §8.2b um plano
> não aplicado por completo não é deletado, e as Fases 1 a 5 continuam pendentes.
>
> **Motivo:** a verificação do estado real encontrou documentação que **afirmava o
> que não era verdade** — e um buraco de contrato em `Evidencia`.
>
> Procedimento único, executado nesta sessão:
>
> | # | Passo | Status |
> |---|-------|--------|
> | 1 | `node` 22.23.3 + `npm ci` (ambiente não existia) | ✅ |
> | 2 | RED: `evidencia.vo.spec.ts` novo + 3 testes de cópia defensiva | ✅ 5 falhas comportamentais |
> | 3 | GREEN: `Evidencia.criar` exige hash + clona `timestamp`; `ItemChecklist` copia na construção e na leitura | ✅ |
> | 4 | Comentário RF-VIST-001 corrigido (não havia guarda) | ✅ |
> | 5 | 4 gates | ✅ 178 testes · coverage · typecheck · lint |
> | 6 | `rastreabilidade.md` vira fonte única; `PENDENTE:` em artefatos-fantasma; duplicatas C-01/C-05 removidas | ✅ |
> | 7 | `documento-software.md` sem coluna de status; correções de texto e de números | ✅ |
>
> **O que a verificação encontrou, e a documentação dizia o contrário:**
>
> - `Evidencia` aceitava `hash` ausente enquanto o DDL exige `hash NOT NULL`
> - `ItemChecklist.evidencias` devolvia o array interno — a "cópia defensiva" que o
>   Lote 6 declarou estar em `Vistoria`, `Ocorrencia`, `ItemChecklist` e
>   `Geolocalizacao` **não existia** em `ItemChecklist`
> - `RF-GRV-001`, `RF-GRV-002`, `RF-SYNC-001`, `RF-SYNC-002` estavam `⬜` com
>   implementação e teste prontos
> - `RF-VIST-001` era dada como PASS em `documento-software.md` **sem nenhuma guarda**
> - `RF-VIST-007` tinha texto de uma regra e implementação de outra
> - C-01 e C-05 apareciam duplicados em §7, um como resolvido e outro como aberto
> - 29 fontes e 33 specs citadas como se existissem
>
> **Pendências abertas por esta sessão:** C-10 (guarda de RF-VIST-001), C-11
> (RF-SYNC-005/006/007 com coluna e sem código), C-12 (RF-EVI-001 parcial), C-13
> (RNF19 sem gate).
>
> **Decisões do responsável:** `rastreabilidade.md` §1 como fonte única de status ·
> marcar alvo em vez de apagar · RF-VIST-001 só corrigir a afirmação, sem implementar
> a guarda · corrigir o `hash` da `Evidencia` com TDD.
>
> > ---
>
> ## Sessão de 16/10/2026 — quarto bloco: correções A1, D-F, C1, B2
>
> Revisão adversarial do passo 1 encontrou **quatro defeitos no meu próprio
> trabalho**. Um deles era da mesma classe que eu dizia ter prevenido.
>
> | ID | Defeito | Correção |
> |----|---------|----------|
> | **A1** | Transação aninhada zerava o buffer da externa e confirmava o próprio conteúdo — **a primeira escrita sumia sem erro nem rastro** | Guarda que lança antes de qualquer efeito colateral |
> | **D-F** | `executar` devolvia sempre `alteracoes: 1`, então `descartarSincronizados(): Promise<number>` era trivialmente verdadeiro | `definirAlteracoes()` programável, default 1 |
> | **C1** | A porta nunca tinha sido confrontada com a API real do SDK | `ExpoSQLiteExecutor` escrito para o `tsc` verificar |
> | **B2** | A porta não executa DDL, e alguém ia adicionar `executarScript` ao bater na parede no passo 4 | Decisão registrada no docblock da porta |
>
> **A1 — o RED expôs perda de dado:**
> ```
> recusa transação aninhada           → Received promise resolved instead of rejected
> a recusa não apaga o que a externa…  → Array [ - "INSERT A" ]
> não confirma nada da aninhada…      → Array [ - "INSERT A", + "INSERT ANINHADO" ]
> ```
>
> **D-F — RED comportamental em três passos:** primeiro o símbolo faltando
> (`TS2339`), depois o método declarado **sem uso** (`Expected 3 / 0 / 7`,
> `Received 1`), só então o comportamento. Das cinco asserções, **três são RED e
> duas são guardas** — marcadas como guardas no arquivo, não contadas como
> descoberta.
>
> **C1 — o compilador confrontou a porta com o SDK, e ela não precisou mudar.**
> Verificado que o gate é real: com um erro deliberado, `tsc` acusou
> `TS2339: Property 'campoQueNaoExiste' does not exist on type 'SQLiteRunResult'`
> e saiu com `exit 2`. Restaurado, `exit 0`.
>
> **Erro meu encontrado no B2:** o docblock da porta afirmava que `SqlParam` "não
> tem `Date` nem `boolean`". Tem `boolean` — o SQLite tem esse tipo. O que a porta
> de fato exclui são os **tipos de blob** (`Uint8Array`/`ArrayBuffer`), que é a
> proteção real da §1.4, e `Date`, que não é tipo de bind e força conversão ISO
> explícita. Corrigido.
>
> **Erro meu de verificação:** um comando meu acusou "VIOLACAO" na pureza de
> `domain`/`application`. Era o comando — `from './x'` não casa com `from '\.\.'`,
> então o `grep -v` devolvia justamente as linhas relativas. Refeito: 21 imports,
> todos relativos, zero externos.
>
> **Ponto cego registrado:** `src/infra` não está no `coverageThreshold`, então o
> `ExpoSQLiteExecutor` está sem teste **e** sem gate de cobertura. Coerente com o
> C-15, mas agora é um arquivo, não uma ausência.
>
> Gates: **206 testes, 20 suítes**, coverage · typecheck · lint com `exit 0`.
> Bundle iOS reconstruído: **0 arquivos com rastro de `expo-sqlite`**.
>
> ---
>
> ## Sessão de 16/10/2026 — terceiro bloco: Fase 1, passo 1
>
> Bundle verificado antes de começar: `npx expo export --platform ios` com cache
> limpo gerou **1500 módulos, 3,5 MB de bytecode Hermes**, `exit 0`. O
> `babel.config.js` criado no bloco anterior não quebra o build. Saída foi para
> `/tmp`, o repositório não foi tocado.
>
> **Passo 1 da Fase 1 — porta `ISQLiteExecutor` e duplo com rollback real.**
> Escolhido após o spike (C-15): o `expo-sqlite` não roda sob Jest, então o
> mapeamento dos repositórios será testado contra um duplo de execução, e a
> compatibilidade de SQL/DDL fica para verificação em dispositivo.
>
> | Arquivo | Camada | Papel |
> |---------|--------|-------|
> | `src/adapters/repositories/sqlite-executor.interface.ts` | adapters | porta de 4 métodos |
> | `__tests__/fakes/sqlite-executor.fake.ts` | teste | duplo com staging de transação |
> | `__tests__/fakes/sqlite-executor.fake.spec.ts` | teste | 17 testes |
>
> **Escopo deliberado:** o passo **não** contém código de produção sem teste. Como
> a implementação real do `expo-sqlite` não tem como ser testada (C-15), ela fica
> para o passo 4, junto de `openDatabaseSync` e das migrations. Por isso a porta
> tem só 4 métodos: cada método a mais seria código a mais confiável só por leitura.
>
> **Prova de não-vacuidade, executada:** removido o staging do duplo para que ele
> escrevesse direto no log confirmado. Os dois testes de rollback falharam
> (`Expected 0, Received 1`) e os outros 15 seguiram verdes. Restaurado.
>
> **Erro de processo meu, registrado:** no primeiro ciclo escrevi `consultar`,
> `consultarUm` e `emTransacao` junto com `executar`, quando o §4.1 pede *código
> mínimo para passar*. Os 15 testes seguintes passaram sem RED — não têm
> demonstração de falha. O teste que importa (rollback) teve a demonstração feita.
>
> **Armadilha de cobertura verificada:** um arquivo só de tipos não entra no
> relatório do Istanbul. As médias de `src/adapters` ficaram **idênticas**
> (94,12 · 85,00 · 97,06 · 97,40, 5 arquivos). Nenhuma exclusão foi necessária.
>
> Gates: **197 testes, 20 suítes**, coverage · typecheck · lint com `exit 0`.
>
> ---
>
> ## Sessão de 16/10/2026 — segundo bloco: passo 1 e spike do SQLite
>
> **Passo 1 — afirmações envelhecidas na tela.** `explore.tsx` exibia `92.6% Cobertura`
> e `11 Suítes de Testes (33/33 passando)` — números de uma fase anterior, que
> envelhecem em silêncio. Removidos: a tela passa a dizer que a cobertura está sob
> gate e onde verificá-la, sem imprimir número fixo.
>
> **Passo 2 — spike do `expo-sqlite`.** Pergunta: dá para exercitar o SQLite com
> gate de cobertura? **Resposta: não, em nenhum dos dois projects.** E o caminho
> até a resposta revelou dois defeitos que ninguém tinha visto:
>
> | Defeito | Efeito | Correção |
> |---------|--------|----------|
> | **`babel.config.js` nunca existiu** | o project `ui` estava declarado desde 13/10 e **não conseguia rodar um único teste** — o `babel-jest` não aplicava o preset de Flow e a suíte morria em `@react-native/jest-preset/jest/setup.js` | arquivo canônico do Expo criado; `__tests__/infra/ui-project.saude.spec.tsx` prova que o project roda |
> | **`expo-modules-core` não estava içado** | dependência declarada pelo próprio `expo`, presente em `node_modules/expo/node_modules/` e ausente do topo; o `setup.js` do jest-expo não a resolve | declarada explicitamente em `devDependencies`, na versão que o `expo` pede |
>
> Nenhum dos dois era visível porque o project `ui` tinha **0 testes** — um project
> de teste sem teste é indistinguível de um que funciona.
>
> Resultado do spike: `core` não parseia o ESM do `expo-sqlite`; `ui` roda mas
> `openDatabaseSync` falha com `NativeDatabase is not a constructor` (não há
> SQLite nativo no ambiente de teste, e o jest-expo não traz mock). Registrado
> como **C-15**, com as implicações para o desenho da Fase 1.
>
> Novo: **C-14** — o RNTL não renderiza por conflito de peer-dependência
> (`test-renderer@^1` pede `react@^19.3.0`, o projeto tem `19.2.3`).
>
> Gates: **180 testes, 19 suítes**, coverage · typecheck · lint com `exit 0`.
>
> ---
>
> # Plano do Dia — SindiFlow — sessão de 13/10/2026 (preservado)

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
| D-12 | **Todos os adapters são fake e toda persistência é `Map`.** Fase 1 passo 2b implementou `OutboxRepositorySQLite`, `VistoriaRepositorySQLite`, `OcorrenciaRepositorySQLite` sobre `ISQLiteExecutor`. Falta: `openDatabaseSync` + migrations (`PRAGMA user_version`) e wire nos use cases | **Fase 1 (em andamento)** |
| C-16 | **Colisão da chave de dedup.** Decidido: coalescer ("último vence", §3.3) | ✅ decidido |
| Supabase | **Não existe projeto Supabase.** `chat_history/2026-09-07.md` registra "nada definido: URL, key, schema, RLS". A Fase 3 fica bloqueada | **Fase 3** |
| C-15 | **`expo-sqlite` não roda sob Jest.** Checklist de dispositivo em `docs/verificacao-dispositivo-sqlite.md` | **dispositivo** |
| T-02 | Repositórios in-memory sem teste | ✅ resolvido na Fase 0.5 |
| C-01..C-09 | 9 cenários de sync/auth sem regra definida (`docs/documento-software.md` §1.6) | Fase 3 / Fase 4 |

---

## 📎 Próximas fases (planejadas, fora do escopo de hoje)

| Fase | Conteúdo | Obrigação |
|------|----------|-----------|
| **1** | `src/infra/db/` (open + migrations por `PRAGMA user_version`) e `src/adapters/repositories/*.sqlite.ts`. Interfaces viram `Promise` | §1.2 |
| | ✅ Passo 2b concluído: `OutboxRepositorySQLite`, `VistoriaRepositorySQLite`, `OcorrenciaRepositorySQLite` + specs (258 testes, 24 suítes) | |
| | ⬽ Falta: `openDatabaseSync` + migrations (`PRAGMA user_version`) e wire nos use cases | |
| **2** | Gateways reais: `expo-image-picker`, `expo-location` (por sessão, §1.4), `expo-network`, `expo-file-system` (`File`/`Paths`, **nunca base64**) | §1.3, §1.4 |
| **2** | Gateways reais: `expo-image-picker`, `expo-location` (por sessão, §1.4), `expo-network`, `expo-file-system` (`File`/`Paths`, **nunca base64**) | §1.3, §1.4 |
| **3** | `src/infra/supabase/`, retry exponencial usando a entidade `OutboxEvent` (hoje órfã), `sync_log`, last-write-wins com `updated_at` | §1.3, §3.3 |
| **4** | `Usuario` + sessão de 7 dias no `SecureStore`, convite por e-mail, aviso 1 dia antes, bloqueio total ao expirar | RF01–RF04 |
| **5** | Notificação imediata para ALTA e alerta de dados órfãos há 30 dias | §3.2, §3.3 |

---

*Criado em 13/10/2026. Fase 0 concluída no mesmo dia. O plano de 29/09/2026 foi arquivado em `plano-do-dia-2026-09-29.md` — conforme `sindiflow-obrigacoes.md` §8, plano não aplicado por completo não é deletado.*
