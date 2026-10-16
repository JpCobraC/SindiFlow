# Rastreabilidade — Regra → Artefato → Teste

**Fonte de verdade da rastreabilidade do SindiFlow** (decisão D-08 de `docs/documento-software.md` §0).
Conferível **manualmente**, sem automação: toda regra tem um identificador estável, um arquivo de código, um arquivo de teste e um Passo do checklist.

**Legenda:** `⬜ não iniciado · 🟡 parcial · ✅ implementado com teste · ⛔ bloqueado · PENDENTE: artefato-alvo que ainda não existe no disco`

> ## Regra de status (correção de 16/10/2026)
>
> Este arquivo é a **fonte única** do status de cada regra. `docs/documento-software.md`
> §1.3 mantém o texto da regra e delega o status para cá — havia duas tabelas
> discordando sobre as mesmas 27 regras.
>
> 1. **`✅` exige arquivo de teste real no repositório** e uma asserção que
>    falharia se a implementação fosse removida. É o que `sindiflow-obrigacoes.md`
>    §4.3 exige ("todo RF tem teste de aceitação vinculado").
> 2. **`🟡` precisa dizer o que falta.** Parcial sem o restante nomeado é
>    indistinguível de implementado.
> 3. **Artefato ou spec que não existe é `PENDENTE:`** — nunca linkado como se
>    existisse. §1 a §5 descrevem a **arquitetura-alvo** das Fases 1 a 5 e são o
>    backlog dessas fases, não um inventário do disco.
>
> Consequência do item 3: até 13/10/2026 este arquivo listava 29 fontes e 33 specs
> que nunca foram escritas, e `documento-software.md` §4 afirmava PASS para
> RF-VIST-001..004 — sendo que RF-VIST-001 não tinha guarda alguma. A regra acima
> é a causa raiz da divergência: o status era escrito sem conferir o disco.

---

## Como conferir

**Convenção de nomes** — o teste espelha o arquivo de código:

| Camada | Código | Teste |
|--------|--------|-------|
| Domain | `src/domain/value-objects/evidencia.vo.ts` | `__tests__/domain/evidencia.vo.spec.ts` |
| Domain | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` |
| Domain | `PENDENTE: src/domain/services/sincronizacao.service.ts` | `PENDENTE: __tests__/domain/sincronizacao.service.spec.ts` |
| Domain | `src/domain/interfaces/*.interface.ts` | sem spec próprio — é contrato; testado pelos use cases |
| Application | `src/application/use-cases/criar-vistoria.usecase.ts` | `__tests__/application/criar-vistoria.usecase.spec.ts` |
| Adapters | `src/adapters/repositories/vistoria.repository.inmemory.ts` | `__tests__/adapters/repositories.inmemory.spec.ts` |
| Adapters | `src/adapters/gateways/camera.gateway.fake.ts` | `__tests__/adapters/camera.gateway.fake.spec.ts` |
| Adapters | `PENDENTE: src/adapters/context/auth-context.tsx` | `PENDENTE: __tests__/adapters/auth-context.spec.tsx` |

**Prioridade** — `P1` entra no código da fase atual; `P2` fica documentada e adiada.
**Passo** — número do checklist de `chat_history/presentation-06-10-26.md` §7 (1 a 8).

### Checklist de conferência manual

- [ ] Todo ID de regra tem um artefato de código listado
- [ ] Todo artefato listado existe no disco, ou está marcado `PENDENTE:`
- [ ] Todo teste listado existe no disco, ou está marcado `PENDENTE:`
- [ ] Nenhum ID aparece duplicado neste arquivo
- [ ] Nenhum ID órfão: toda regra de `docs/documento-software.md` §1.3 tem linha aqui
- [ ] Todo item `⛔` tem um cenário C-xx ou uma decisão associada
- [ ] Nenhuma regra marcada `✅` sem teste correspondente **que exista**
- [ ] Nenhuma regra `🟡` sem dizer o que falta
- [ ] Nenhuma linha de `docs/documento-software.md` afirma estado que este arquivo contradiga

---

## 1. Regras de Negócio do Domínio

### RF-VIST — ciclo de vida da vistoria

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-VIST-001 | Vistoria inicia sempre em `RASCUNHO` | `src/domain/entities/vistoria.entity.ts:44-52` — **sem guarda de transição** | `PENDENTE:` spec | 1 | P1 | ⬜ |
| RF-VIST-002 | Finalizar exige ≥80% dos itens marcados | `src/domain/entities/vistoria.entity.ts:116` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-003 | Item `CRITICO` sem justificativa bloqueia finalização | `src/domain/entities/vistoria.entity.ts:122-133` + `item-checklist.entity.ts:66` | `__tests__/domain/vistoria.entity.spec.ts` · `item-checklist.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-004 | Geolocalização obrigatória para finalizar | `src/domain/entities/vistoria.entity.ts:100` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-005 | Uma vistoria ativa por condomínio | — sem implementação | `PENDENTE:` spec | 2 | P1 | ⬜ |
| RF-VIST-006 | Troca de perfil não expõe rascunho alheio | `PENDENTE: src/domain/entities/usuario.entity.ts` | `PENDENTE:` spec | 2 | P1 | ⬜ |
| RF-VIST-007 | **Vistoria `FINALIZADA` é imutável, inclusive na reidratação do banco** | `src/domain/entities/vistoria.entity.ts:64-70` (construtor) e `:104-135` (`finalizar`) | `__tests__/domain/vistoria.entity.spec.ts:160` | 2 | P2 | ✅ |

> **RF-VIST-001 foi corrigida em 16/10/2026.** Até 13/10 esta linha dizia *"Checklist
> imutável após início da vistoria"* e estava `⬜`, enquanto o código e
> `chat_history/2026-10-13.md` tratavam RF-VIST-007 como *"vistoria finalizada
> imutável"*. A regra escrita e a regra implementada eram diferentes. O texto
> acima é o que o código e o teste realmente garantem.
>
> A parte *"itens novos só em `RASCUNHO`"* não tem implementação: **não existe
> API de adicionar item** — `_itens` só é atribuído no construtor. Se essa
> exigência for real, precisa de método novo, teste e decisão própria.
>
> **RF-VIST-001 continua `⬜` por decisão explícita.** O construtor não tem guarda
> de transição, e precisa de uma: a reidratação do banco monta a vistoria a
> partir da linha e uma vistoria já finalizada **tem** de voltar finalizada.
> A regra estreita que falta é "apenas criação recusa status ≠ `RASCUNHO`",
> sem colidir com a leitura. Registrada como pendência em §7.

### RF-GRV — gravidade, foto e SLA

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-GRV-001 | ALTA 24h · MÉDIA 72h · BAIXA 168h | `src/domain/entities/ocorrencia.entity.ts:93-101` | `__tests__/domain/ocorrencia.entity.spec.ts` | 1 | P1 | ✅ |
| RF-GRV-002 | Foto obrigatória ALTA, recomendada MÉDIA, opcional BAIXA | `src/domain/entities/ocorrencia.entity.ts:57-61` | `__tests__/domain/ocorrencia.entity.spec.ts` | 2 | P1 | ✅ |
| RF-GRV-003 | Notificação imediata ALTA, digest diário MÉDIA, nenhuma BAIXA | `PENDENTE:` sem implementação | `PENDENTE:` spec | 3 | P1 | ⬜ |
| RF-GRV-004 | SLA em dias corridos, contados da abertura do achado | `ocorrencia.entity.ts:104-108` (prazo a partir de `dataCriacao`) | `__tests__/domain/ocorrencia.entity.spec.ts` | 1 | P1 | 🟡 **falta:** não há noção de *dia corrido* distinta de horas decorridas; o prazo é aritmética de milissegundos |
| RF-GRV-005 | Violação de SLA escala ao síndico | — sem implementação | `PENDENTE:` spec | 3 | P2 | ⬜ |
| RF-GRV-006 | Reclassificação de gravidade com trilha e recálculo de SLA | — sem implementação | `PENDENTE:` spec | 2/3 | P2 | ⬜ |

> RF-GRV-001, -002 e a origem de `RF-GRV-006` dependem da decisão **D-06** (onde a
> gravidade mora) — ver `docs/documento-software.md` §0.1.

### RF-SYNC — fila, retry, conflito e idempotência

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-SYNC-001 | Toda escrita passa pela outbox | `criar-vistoria` · `classificar-item` · `finalizar-vistoria` · `registrar-ocorrencia` · `anexar-foto` (todos em `src/application/use-cases/`) | `PENDENTE:` specs individuais | 1/4/5 | P1 | ✅ 5/5 use cases de escrita |
| RF-SYNC-002 | Retry exponencial 1s, 2s, 4s, 8s, 16s — máx. 5 tentativas | `src/domain/entities/outbox-event.entity.ts:140-158` | `__tests__/domain/outbox-event.entity.spec.ts` | 3 | P1 | ✅ |
| RF-SYNC-003 | Rede verificada antes de qualquer tentativa | `src/application/use-cases/sincronizar-outbox.usecase.ts:45-47` | `__tests__/application/sincronizar-outbox.usecase.spec.ts` | 3 | P1 | 🟡 **falta:** a checagem existe e é testada, mas roda contra `network.service.fake` — o adapter `expo-network` é a Fase 2 |
| RF-SYNC-004 | Sync de usuário revogado é rejeitado, com log | `PENDENTE: src/domain/entities/usuario.entity.ts` | `PENDENTE:` spec | 2/5 | P1 | ⬜ |
| RF-SYNC-005 | Conflito: vence o `updated_at` maior | `infra/db/sqlite-schema.ts` tem a coluna; **nenhum código compara** | `PENDENTE:` spec | 3 | P1 | ⬜ |
| RF-SYNC-006 | Log de auditoria por sync + alerta de órfãos em 30 dias | `sqlite-schema.ts:123` cria `sync_log`; **nada escreve nele** | `PENDENTE:` spec | 3 | P1 | ⬜ |
| RF-SYNC-007 | Chave de deduplicação: reenvio nunca duplica | `sqlite-schema.ts:111,116` tem `chave_dedup` + índice único; **nenhum código produz ou consome** | `PENDENTE:` spec | 1/4/5 | P1 | ⬜ |
| RF-SYNC-008 | Envio FIFO respeitando FK usuário → vistoria → item → evidência | `PENDENTE:` sem implementação | `PENDENTE:` spec | 3/5 | P1 | ⬜ |
| RF-SYNC-009 | Status agregado por vistoria: PARCIAL / TOTAL / COM_ERRO | `PENDENTE:` sem implementação | `PENDENTE:` spec | 1/3 | P1 | ⬜ |
| RF-SYNC-010 | Relógio do dispositivo não altera o desempate | `PENDENTE:` sem implementação | `PENDENTE:` spec | 3 | P1 | ⬜ |

> **RF-SYNC-005 a -007 têm coluna no DDL e nada no código.** É a mesma armadilha que
> o Lote 9 caiu: o schema projeta o que o domínio precisa, e a existência da coluna
> parece implementação. `grep -r chaveDedup src/` não retorna nada.

### RF-EVI — evidência fotográfica

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-EVI-001 | Hash obrigatório e arquivo local presente para exibir offline | `src/domain/value-objects/evidencia.vo.ts` + `domain/interfaces/camera.gateway.interface.ts` | `__tests__/domain/evidencia.vo.spec.ts` | 2 | P1 | 🟡 **hash obrigatório: ✅ desde 16/10.** **falta:** "arquivo local presente" exige `expo-file-system` (Fase 2) |
| RF-EVI-002 | Mesmo hash ocupa um arquivo; limite de fotos por vistoria | — sem implementação | `PENDENTE:` spec | 2 | P2 | ⬜ |

> **RF-EVI-001 é parcial, não total.** A metade do hash foi fechada em 16/10: o VO
> aceitava `hash` ausente enquanto o DDL declara `hash NOT NULL`, e a reidratação
> da Fase 1_construiria uma evidência sem hash que o banco rejeitaria. A outra
> metade — verificar que o arquivo existe no disco — só é possível com
> `expo-file-system`, hoje com 0 imports no projeto.

### RF-SEC — segurança e auditoria

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-SEC-001 | Remover registro apaga mídia e itens pendentes da outbox | — sem implementação | `PENDENTE:` spec | 2/3 | P1 | ⬜ |
| RF-SEC-002 | Trilha de auditoria append-only | — sem implementação | `PENDENTE:` spec | 3 | P2 | ⬜ |

---

## 2. Requisitos Funcionais (RF01-RF20)

> **Catálogo planejado, não implementado.** A numeração RF01–RF20 é a que
> `docs/documento-software.md` usa; a de `sindiflow-obrigacoes.md` §6 (RF01–RF07) é
> obsoleta e está em K-01. Os nomes de use case abaixo são os **planejados** e
> divergem dos que existem — `SincronizarFilaUseCase` ↔ `SincronizarOutboxUseCase`,
> `RegistrarVistoriaUseCase` ↔ `CriarVistoriaUseCase`.

| ID | Caso de uso (planejado) | Regras | Passo | Prio | Teste previsto |
|----|-------------|--------|-------|------|----------------|
| RF01 | `AutenticarUsuarioUseCase` | RF-SYNC-004, RF-SEC-001 | 5 | P1 | `PENDENTE: __tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF02 | `AcessarViaTokenUseCase`, `AssinarVistoriaUseCase` | — | 5 | P1 | `PENDENTE: __tests__/application/acessar-via-token.usecase.spec.ts` |
| RF03 | `AutenticarUsuarioUseCase` | — | 5 | P1 | `PENDENTE: __tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF04 | `AutenticarUsuarioUseCase` | — | 5 | P1 | `PENDENTE: __tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF05 | `RegistrarVistoriaUseCase` | RF-VIST-001, RF-VIST-005 | 5 | P1 | `PENDENTE: __tests__/application/registrar-vistoria.usecase.spec.ts` |
| RF06 | `AnexarFotoUseCase` | RF-GRV-002 | 5 | P1 | `__tests__/application/anexar-foto.usecase.spec.ts` ✅ |
| RF07 | `AnexarFotoUseCase` | — | 5 | P1 | `__tests__/application/anexar-foto.usecase.spec.ts` ✅ |
| RF08 | `GerarRelatorioUseCase`, `AvaliarDesempenhoUseCase` | RF-GRV-001, RF-GRV-004 | 5 | P1 | `PENDENTE: __tests__/application/avaliar-desempenho.usecase.spec.ts` |
| RF09 | `SincronizarFilaUseCase` | RF-GRV-003 | 5 | P1 | `PENDENTE: __tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF10 | `SincronizarFilaUseCase` | RF-GRV-003 | 5 | P1 | `PENDENTE: __tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF11 | todos os use cases de escrita | RF-SYNC-001 | 5 | P1 | specs dos 5 use cases de escrita ✅ |
| RF12 | `SincronizarOutboxUseCase` | RF-SYNC-002 | 5 | P1 | `__tests__/domain/outbox-event.entity.spec.ts` + `sincronizar-outbox.usecase.spec.ts` ✅ |
| RF13 | `SincronizarOutboxUseCase` | RF-SYNC-003 | 5 | P1 | `__tests__/application/sincronizar-outbox.usecase.spec.ts` ✅ |
| RF14 | `SincronizarFilaUseCase` | RF-SYNC-004 | 5 | P1 | `PENDENTE: __tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF15 | `ConsultarHistoricoUseCase` | — | 5 | P1 | `__tests__/application/consultar-historico.usecase.spec.ts` ✅ |
| RF16 | `ConsultarHistoricoUseCase`, `DevolverVistoriaUseCase` | — | 5 | P1 | `__tests__/application/consultar-historico.usecase.spec.ts` ✅ |
| RF17 | `RegistrarVistoriaUseCase`, `RealizarAutoAvaliacaoUseCase` | RF-VIST-007 | 5 | P1 | `PENDENTE: __tests__/application/realizar-autoavaliacao.usecase.spec.ts` |
| RF18 | `AnotarVistoriaUseCase` | — | 5 | P1 | `PENDENTE: __tests__/application/anotar-vistoria.usecase.spec.ts` |
| RF19 | `AprovarVistoriaUseCase` | — | 2/5 | P1 | `PENDENTE: __tests__/domain/usuario.entity.spec.ts` |
| RF20 | `RegistrarVistoriaUseCase` | RF-EVI-002 | 5 | P2 | `PENDENTE: __tests__/application/registrar-vistoria.usecase.spec.ts` |

---

## 3. Requisitos Não Funcionais (RNF01-RNF19)

RNFs não têm teste unitário próprio: são verificados porconstraint de arquitetura, por teste do comportamento que o garante, ou por inspeção. A coluna "Como verificar" diz qual.

| ID | Restrição | Como verificar | Passo | Prio | Status |
|----|-----------|----------------|-------|------|--------|
| RNF01 | Nenhuma escrita depende de rede | specs de use case com `NetworkGatewayFake` offline | 5 | P1 | ⬜ |
| RNF02 | Permissão no primeiro uso; negada bloqueia sem crash | specs de `CapturarLocalizacaoUseCase` e `AnexarFotoUseCase` com permissão negada | 5 | P1 | ✅ |
| RNF03 | GPS por sessão, nunca por item | spec de `CapturarLocalizacaoUseCase` | 5 | P1 | ✅ |
| RNF04 | Limite de espaço e ordem de limpeza | spec de `RegistrarVistoriaUseCase` no limite | 5 | P2 | ⬜ |
| RNF05 | Last-write-wins por `updated_at` do servidor | spec de `SincronizacaoService` | 3 | P1 | ⬜ |
| RNF06 | Token em `expo-secure-store`, nunca `AsyncStorage` | `jest.mock('expo-secure-store')` + inspeção de import | 8 | P1 | ⬜ |
| RNF07 | Versões mínimas declaradas iOS/Android | `app.json` | 2 | P2 | ⬜ |
| RNF08 | Feedback visual do estado de sync | spec de `DashboardScreen` (RNTL) | 7 | P1 | ⬜ |
| RNF09 | Operação offline < 500ms | medição manual em device | 8 | P1 | ⬜ |
| RNF10 | TLS em todo sync | verificação de configuração | 8 | P1 | ⬜ |
| RNF11 | Navegação em 1 toque | revisão de tela | 7 | P2 | ⬜ |
| RNF12 | 30 dias offline | teste de durabilidade | 8 | P1 | ⬜ |
| RNF13 | Paridade iOS/Android | build das duas plataformas | 8 | P2 | ⬜ |
| RNF14 | LGPD: coleta mínima e apagado | spec de remoção (RF-SEC-001) | 2/3 | P1 | ⬜ |
| RNF15 | Sync em 2º plano só com Wi-Fi ou carregando | spec de `SincronizarFilaUseCase` | 5 | P1 | ⬜ |
| RNF16 | Alteração concorrente é detectada e avisada | spec de `SincronizacaoService` | 3 | P2 | ⬜ |
| RNF17 | Toque ≥ 44pt, texto escalável, sem depender de cor | spec de tela (RNTL) | 7 | P2 | ⬜ |
| RNF18 | Log local sem PII | spec do logger + revisão de `jest` snapshot | 3 | P2 | ⬜ |
| RNF19 | Zero import de React/Expo/SDK em domain e application | `PENDENTE: __tests__/arquitetura/clean-architecture.spec.ts` — **hoje só por inspeção** (`grep -rE "from '(react\|expo\|react-native\|@react)" src/domain src/application` → vazio) | 1 | P1 | 🟡 **cumprido, sem gate** |

---

## 4. Casos de Uso (15)

> Catálogo dos 15 casos de uso planejados. **UC15 é o único implementado** —
> `ConsultarHistoricoUseCase` existe e tem spec. Os outros 14 são o backlog das
> Fases 1 a 5; nenhum arquivo `src/application/use-cases/` fora da lista de
> implementado existe hoje.

| ID | Use case | Regras | Artefato | Teste | Prio | Status |
|----|----------|--------|----------|-------|------|--------|
| UC01 | `RegistrarVistoriaUseCase` | RF-VIST-001/005, RF-SYNC-001 | `PENDENTE: src/application/use-cases/registrar-vistoria.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC02 | `FinalizarVistoriaUseCase` | RF-VIST-002/003/004, RF-SYNC-001 | `src/application/use-cases/finalizar-vistoria.usecase.ts` | `__tests__/application/finalizar-vistoria.usecase.spec.ts` | P1 | ✅ |
| UC03 | `AnotarVistoriaUseCase` | RF-VIST-003/007 | `PENDENTE: src/application/use-cases/anotar-vistoria.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC04 | `CapturarLocalizacaoUseCase` | RF-VIST-004 | `src/application/use-cases/capturar-localizacao.usecase.ts` | `__tests__/application/capturar-localizacao.usecase.spec.ts` | P1 | ✅ |
| UC05 | `AnexarFotoUseCase` | RF-EVI-001, RF-GRV-002 | `src/application/use-cases/anexar-foto.usecase.ts` | `__tests__/application/anexar-foto.usecase.spec.ts` | P1 | ✅ |
| UC06 | `SincronizarFilaUseCase` (existe como `SincronizarOutboxUseCase`) | RF-SYNC-002..007 | `src/application/use-cases/sincronizar-outbox.usecase.ts` | `__tests__/application/sincronizar-outbox.usecase.spec.ts` | P1 | 🟡 **parcial:** cobre 002, 003, 005 e 007 · **falta:** 004, 006, 008, 009, 010 |
| UC07 | `GerarRelatorioUseCase` | RF-GRV-004, RF-SYNC-009 | `PENDENTE: src/application/use-cases/gerar-relatorio.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC08 | `AutenticarUsuarioUseCase` | RF-SYNC-004, RF-SEC-001 | `PENDENTE: src/application/use-cases/autenticar-usuario.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC09 | `AcessarViaTokenUseCase` | — | `PENDENTE: src/application/use-cases/acessar-via-token.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC10 | `AvaliarDesempenhoUseCase` | RF-GRV-004/005 | `PENDENTE: src/application/use-cases/avaliar-desempenho.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC11 | `RealizarAutoAvaliacaoUseCase` | RF-VIST-002 | `PENDENTE: src/application/use-cases/realizar-autoavaliacao.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC12 | `AssinarVistoriaUseCase` | — | `PENDENTE: src/application/use-cases/assinar-vistoria.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC13 | `AprovarVistoriaUseCase` | RF19 | `PENDENTE: src/application/use-cases/aprovar-vistoria.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC14 | `DevolverVistoriaUseCase` | RF-VIST-002/003 | `PENDENTE: src/application/use-cases/devolver-vistoria.usecase.ts` | `PENDENTE:` spec | P1 | ⬜ |
| UC15 | `ConsultarHistoricoUseCase` | — | `src/application/use-cases/consultar-historico.usecase.ts` | `__tests__/application/consultar-historico.usecase.spec.ts` | P1 | ✅ |

> `CriarVistoriaUseCase` e seu spec hoje existentes são absorvidos por UC01 no Passo 5 (D-02).

---

## 5. Telas e Adaptadores

> Telas e adapters planejados, ainda não escritos. Os `*Fake` que existem são a
> única implementação real — e serão **substituídos**, não preservados (D-12).

| Artefato | Passo | Prio | Teste | Status |
|----------|-------|------|-------|--------|
| `PENDENTE: src/adapters/context/auth-context.tsx` | 6 | P1 | `PENDENTE: __tests__/adapters/auth-context.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/hooks/use-auth.ts` | 6 | P1 | `PENDENTE: __tests__/adapters/use-auth.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/hooks/use-ocorrencias.ts` | 6 | P1 | `PENDENTE: __tests__/adapters/use-ocorrencias.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/screens/login.screen.tsx` | 7 | P1 | `PENDENTE: __tests__/adapters/login.screen.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/screens/vistoria-form.screen.tsx` | 7 | P1 | `PENDENTE: __tests__/adapters/vistoria-form.screen.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/screens/historico-relatorios.screen.tsx` | 7 | P1 | `PENDENTE: __tests__/adapters/historico-relatorios.screen.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/screens/assinatura.screen.tsx` | 7 | P2 | `PENDENTE: __tests__/adapters/assinatura.screen.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/screens/dashboard.screen.tsx` | 7 | P1 (RNF08) | `PENDENTE: __tests__/adapters/dashboard.screen.spec.tsx` | ⬜ |
| `PENDENTE: src/adapters/auth/session-storage.securestore.ts` | 8 | P1 | `PENDENTE: __tests__/adapters/session-storage.securestore.spec.ts` (com `jest.mock`) | ⬜ |
| `src/adapters/gateways/camera.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/camera.gateway.fake.spec.ts` | ✅ |
| `src/adapters/gateways/location.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/location.gateway.fake.spec.ts` | ✅ |
| `src/adapters/gateways/network.service.fake.ts` | 4 | P1 | `__tests__/application/sincronizar-outbox.usecase.spec.ts` | 🟡 **falta:** sem spec próprio |
| `src/adapters/gateways/remote-sync.gateway.fake.ts` | 4 | P1 | `__tests__/application/sincronizar-outbox.usecase.spec.ts` | 🟡 **falta:** sem spec próprio |
| `src/adapters/repositories/*.inmemory.ts` | 4/5 | P1 (T-02) | `__tests__/adapters/repositories.inmemory.spec.ts` · `outbox.repository.inmemory.spec.ts` | ✅ **T-02 resolvido em 13/10/2026** |

---

## 6. Cobertura exigida

| Camada | Meta | Ferramenta | Como é medida |
|--------|------|------------|---------------|
| `src/domain/**` | **≥90%** | Jest | `coverageThreshold` no `jest.config.js` — **medido desde 13/10/2026** (T-01 resolvido) |
| `src/application/**` | **≥80%** | Jest | idem |
| `src/adapters/**` | cobertura de mapeamento | Jest | **no gate desde 13/10/2026** (70/60) |
| Telas e hooks | **≥80%** | `@testing-library/react-native` | idem |

Estado apurado em **16/10/2026** com `npm run coverage` (**178 testes, 18 suítes**):

| Camada | Statements | Branches | Funções | Linhas | Gate |
|--------|-----------|----------|---------|--------|------|
| `src/domain/**` | 99,10% | 91,91% | 100% | 99,69% | ✅ ≥90% |
| `src/application/**` | 98,91% | 90,16% | 100% | 100% | ✅ ≥80% |
| `src/adapters/**` | 94,12% | 85,00% | 97,06% | 97,40% | ✅ ≥70% |

> Números agregados por camada, lidos de `coverage/coverage-summary.json`
> (`--coverageReporters=json-summary`), **não** copiados da tabela por diretório:
> os thresholds do Jest são avaliados por glob (`./src/domain/`), e o relatório de
> texto só mostra médias por pasta. Um número agregado aqui que ninguém reproduz é
> exatamente o defeito que esta seção corrige.
>
> Ponto fraco: `src/adapters/repositories/` está em **70% de branches** — acima do
> piso de 60 do gate, mas é o trecho mais distante de estar completo.

> O `coverageThreshold` precisa estar na **raiz** do `jest.config.js`. Dentro de um
> entry de `projects` o Jest 29 o ignora silenciosamente — foi verificado empiricamente
> que um limite de 99% ainda saía com `exit 0`.

Nenhum teste toca câmera, GPS, autenticação ou Supabase reais: são sempre fakes.
**Essa regra mudou em 13/10/2026** — a decisão D-11 ("100% mock") foi revogada e a
implementação real (Fases 1 a 5) substitui os fakes. Ver `chat_history/2026-10-13.md`.

---

## 7. Pendências abertas

| ID | Pendência | Bloqueia | Status |
|----|-----------|----------|--------|
| D-06 | Onde a gravidade mora: `ItemChecklist` ou `Vistoria` | Passo 2 | ✅ **Resolvido em 13/10/2026** — são dois conceitos: `ItemChecklist.status` (§3.1) e `Ocorrencia.gravidade` (§3.2). Ver `docs/documento-software.md` §0.1 |
| C-01 | Desfecho da 5ª tentativa de sync | Passo 3 | ✅ **Resolvido em 13/10/2026** — `FALHA_MAXIMA` terminal + `resetar()` |
| C-05 | Retry em erro 4xx versus 5xx | Passo 3 | ✅ **Resolvido em 13/10/2026** — `ErroSincronizacao.transitorio`; 4xx vai direto a dead-letter |
| C-02 | Política de estouro da fila | Passo 3 | ⬜ |
| C-03 | Sync com usuário revogado | Passo 5 | ⬜ |
| C-04 | Sessão expirada com rascunho local | Passo 5/6 | ⬜ |
| C-06 | Token de convite reusado ou expirado | Passo 5 | ⬜ |
| C-07 | Arquivo de evidência removido pelo SO | Passo 2 | ⬜ |
| C-08 | Relógio do dispositivo incorreto | Passo 3 | ⬜ |
| C-09 | Logout com itens pendentes na fila | Passo 5 | ⬜ |
| T-01 | `jest.config.js` sem `jest-expo` nem `coverageThreshold` | Passo 1 | ✅ **Resolvido em 13/10/2026** |
| T-02 | Repositórios in-memory sem teste | Passo 5 | ✅ **Resolvido em 13/10/2026** — `__tests__/adapters/outbox.repository.inmemory.spec.ts` + `__tests__/adapters/repositories.inmemory.spec.ts`; `src/adapters/` entrou no gate |
| T-03 | Artefatos web do template (violação de §1.1) | qualquer revisão da obrigação | ✅ **Resolvido em 13/10/2026** |
| K-05 | `sindiflow-obrigacoes.md` §1.1/§7 e `AGENTS.md` diziam Expo SDK 54 enquanto o código roda em `expo@^57.0.27` | qualquer trabalho com API Expo | ✅ **Resolvido em 13/10/2026** — lei na versão 1.2.0, alinhada ao SDK 57 |

### Pendências abertas em 16/10/2026

| ID | Pendência | Resolve em |
|----|-----------|------------|
| **C-10** | **RF-VIST-001 não tem guarda.** `Vistoria.criar({ status: FINALIZADA })` constrói sem reclamar. A regra precisa ser "criação recusa status ≠ RASCUNHO" **sem** colidir com a reidratação do banco, que precisa devolver a vistoria já finalizada. Decisão de projeto, não correção mecânica | Fase 1, junto do adapter SQLite |
| **C-11** | **RF-SYNC-005/006/007 têm coluna no DDL e zero código.** `updated_at`, `sync_log` e `chave_dedup` existem no schema; nenhum arquivo em `src/` produz ou consome. O Lote 9 criou as colunas e documentou isso como pronto | Fase 1 e Fase 3 |
| **C-12** | **RF-EVI-001 parcial.** O hash obrigatório foi fechado em 16/10; "arquivo local presente" exige `expo-file-system`, hoje com 0 imports no projeto | Fase 2 |
| **C-13** | **RNF19 sem gate.** A pureza de `domain`/`application` é verificada por `grep`, não por teste. Um `import { SQLite } from 'expo-sqlite'` em `domain/` compila — o typecheck aceita qualquer pacote instalado, então só a inspeção pega | qualquer momento — teste barato |
| **K-01** | `sindiflow-obrigacoes.md` §6 lista RF01="Fazer Vistoria"…RF07="Classificar Checklist" (numeração obsoleta), contradizendo §3.1 e o README. **Fora do escopo da correção de 16/10**: alterar a lei exige issue `[OBRIGAÇÃO]` e aprovação de 2 arquitetos (§9) | issue `[OBRIGAÇÃO]` |

> **C-01 e C-05 apareciam duas vezes nesta tabela** — uma linha `✅ Resolvido` e
> outra `⬜` para o mesmo ID, com o mesmo cenário. A duplicata foi removida em
> 16/10/2026; o item "Nenhum ID aparece duplicado" do checklist em §"Como conferir"
> passa a ser cumprido.

Detalhamento de cada cenário em `docs/documento-software.md` §1.6 e §0.2.

---

*Documento criado em 29/09/2026 na Fase 0, conforme decisão D-08. É a fonte de conferência manual da rastreabilidade do SindiFlow.*
