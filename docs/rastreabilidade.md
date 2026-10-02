# Rastreabilidade — Regra → Artefato → Teste

**Fonte de verdade da rastreabilidade do SindiFlow** (decisão D-08 de `docs/documento-software.md` §0).
Conferível **manualmente**, sem automação: toda regra tem um identificador estável, um arquivo de código, um arquivo de teste e um Passo do checklist.

**Legenda:** `⬜ não iniciado · 🟡 parcial · ✅ implementado com teste · ⛔ bloqueado`

---

## Como conferir

**Convenção de nomes** — o teste espelha o arquivo de código:

| Camada | Código | Teste |
|--------|--------|-------|
| Domain | `src/domain/value-objects/gravidade.vo.ts` | `__tests__/domain/gravidade.vo.spec.ts` |
| Domain | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` |
| Domain | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` |
| Domain | `src/domain/interfaces/*.interface.ts` | sem spec próprio — é contrato; testado pelos use cases |
| Application | `src/application/use-cases/registrar-vistoria.usecase.ts` | `__tests__/application/registrar-vistoria.usecase.spec.ts` |
| Adapters | `src/adapters/repositories/vistoria.repository.inmemory.ts` | `__tests__/adapters/vistoria.repository.inmemory.spec.ts` |
| Adapters | `src/adapters/gateways/camera.gateway.fake.ts` | `__tests__/adapters/camera.gateway.fake.spec.ts` |
| Adapters | `src/adapters/context/auth-context.tsx` | `__tests__/adapters/auth-context.spec.tsx` |

**Prioridade** — `P1` entra no código da fase atual; `P2` fica documentada e adiada.
**Passo** — número do checklist de `chat_history/presentation-06-10-26.md` §7 (1 a 8).

### Checklist de conferência manual

- [ ] Todo ID de regra tem um artefato de código listado
- [ ] Todo artefato listado existe no disco (ou está corretamente marcado como não iniciado)
- [ ] Todo teste listado existe (ou está marcado como não iniciado)
- [ ] Nenhum ID aparece duplicado neste arquivo
- [ ] Nenhum ID órfão: toda regra de `docs/documento-software.md` §1.2 e §1.3 tem linha aqui
- [ ] Todo item `⛔` tem um cenário C-xx ou uma decisão associada
- [ ] Nenhuma regra marcada `✅` sem teste correspondente

---

## 1. Regras de Negócio do Domínio

### RF-VIST — ciclo de vida da vistoria

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-VIST-001 | Vistoria inicia sempre em `RASCUNHO` | `src/domain/value-objects/status-vistoria.vo.ts` | `__tests__/domain/status-vistoria.vo.spec.ts` | 1 | P1 | ⬜ |
| RF-VIST-002 | Finalizar exige ≥80% dos itens marcados | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-003 | Item `CRITICO` sem justificativa bloqueia finalização | `src/domain/entities/item-checklist.entity.ts` | `__tests__/domain/item-checklist.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-004 | Geolocalização obrigatória para finalizar | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ✅ |
| RF-VIST-005 | Uma vistoria ativa por condomínio | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ⬜ |
| RF-VIST-006 | Troca de perfil não expõe rascunho alheio | `src/domain/entities/usuario.entity.ts` | `__tests__/domain/usuario.entity.spec.ts` | 2 | P1 | ⬜ |
| RF-VIST-007 | Checklist imutável após início da vistoria | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P2 | ⬜ |

> RF-VIST-001 aparece hoje como default do construtor em `vistoria.entity.ts:42`; com o Passo 1 a regra passa a viver no VO `StatusVistoria` e ganha spec própria.

### RF-GRV — gravidade, foto e SLA

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-GRV-001 | ALTA 24h · MÉDIA 72h · BAIXA 168h | `src/domain/value-objects/gravidade.vo.ts` | `__tests__/domain/gravidade.vo.spec.ts` | 1 | P1 | ⬜ |
| RF-GRV-002 | Foto obrigatória ALTA, recomendada MÉDIA, opcional BAIXA | `src/domain/entities/foto-evidencia.entity.ts` + `vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2 | P1 | ⬜ |
| RF-GRV-003 | Notificação imediata ALTA, digest diário MÉDIA, nenhuma BAIXA | `src/domain/services/regra-geracao-relatorio.service.ts` | `__tests__/domain/regra-geracao-relatorio.service.spec.ts` | 3 | P1 | ⬜ |
| RF-GRV-004 | SLA em dias corridos, contados da abertura do achado | `src/domain/value-objects/sla-data.vo.ts` | `__tests__/domain/sla-data.vo.spec.ts` | 1 | P1 | ⬜ |
| RF-GRV-005 | Violação de SLA escala ao síndico | `src/domain/services/regra-geracao-relatorio.service.ts` | `__tests__/domain/regra-geracao-relatorio.service.spec.ts` | 3 | P2 | ⬜ |
| RF-GRV-006 | Reclassificação de gravidade com trilha e recálculo de SLA | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2/3 | P2 | ⬜ |

> RF-GRV-001..003 e RF-GRV-006 dependem da decisão **D-06** (onde a gravidade mora) — ver `docs/documento-software.md` §0.1.

### RF-SYNC — fila, retry, conflito e idempotência

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-SYNC-001 | Toda escrita passa pela outbox | `src/domain/interfaces/outbox.repository.interface.ts` | `__tests__/application/finalizar-vistoria.usecase.spec.ts` | 1/4/5 | P1 | 🟡 |
| RF-SYNC-002 | Retry exponencial 1s, 2s, 4s, 8s, 16s — máx. 5 tentativas | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P1 | ⬜ |
| RF-SYNC-003 | Rede verificada antes de qualquer tentativa | `src/domain/interfaces/network.service.interface.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P1 | 🟡 |
| RF-SYNC-004 | Sync de usuário revogado é rejeitado, com log | `src/domain/entities/usuario.entity.ts` | `__tests__/domain/usuario.entity.spec.ts` | 2/5 | P1 | ⬜ |
| RF-SYNC-005 | Conflito: vence o `updated_at` maior | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P1 | ⬜ |
| RF-SYNC-006 | Log de auditoria por sync + alerta de órfãos em 30 dias | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P1 | ⬜ |
| RF-SYNC-007 | Chave de deduplicação: reenvio nunca duplica | `src/domain/interfaces/outbox.repository.interface.ts` | `__tests__/application/sincronizar-fila.usecase.spec.ts` | 1/4/5 | P1 | ⬜ |
| RF-SYNC-008 | Envio FIFO respeitando FK usuário → vistoria → item → evidência | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3/5 | P1 | ⬜ |
| RF-SYNC-009 | Status agregado por vistoria: PARCIAL / TOTAL / COM_ERRO | `src/domain/value-objects/status-sincronizacao.vo.ts` | `__tests__/domain/status-sincronizacao.vo.spec.ts` | 1/3 | P1 | ⬜ |
| RF-SYNC-010 | Relógio do dispositivo não altera o desempate | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P1 | ⬜ |

### RF-EVI — evidência fotográfica

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-EVI-001 | Hash obrigatório e arquivo local presente para exibir offline | `src/domain/entities/foto-evidencia.entity.ts` | `__tests__/domain/foto-evidencia.entity.spec.ts` | 2 | P1 | ⬜ |
| RF-EVI-002 |Mesmo hash ocupa um arquivo; limite de fotos por vistoria | `src/domain/entities/foto-evidencia.entity.ts` | `__tests__/domain/foto-evidencia.entity.spec.ts` | 2 | P2 | ⬜ |

> O `Evidencia` VO atual (`src/domain/value-objects/evidencia.vo.ts`, sem teste) é substituído por `FotoEvidencia` no Passo 2 — a geolocalização não pode ser campo da evidência (`sindiflow-obrigacoes.md` §1.4).

### RF-SEC — segurança e auditoria

| ID | Regra | Artefato | Teste | Passo | Prio | Status |
|----|-------|----------|-------|-------|------|--------|
| RF-SEC-001 | Remover registro apaga mídia e itens pendentes da outbox | `src/domain/entities/vistoria.entity.ts` | `__tests__/domain/vistoria.entity.spec.ts` | 2/3 | P1 | ⬜ |
| RF-SEC-002 | Trilha de auditoria append-only | `src/domain/services/sincronizacao.service.ts` | `__tests__/domain/sincronizacao.service.spec.ts` | 3 | P2 | ⬜ |

---

## 2. Requisitos Funcionais (RF01-RF20)

| ID | Caso de uso | Regras | Passo | Prio | Teste previsto |
|----|-------------|--------|-------|------|----------------|
| RF01 | `AutenticarUsuarioUseCase` | RF-SYNC-004, RF-SEC-001 | 5 | P1 | `__tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF02 | `AcessarViaTokenUseCase`, `AssinarVistoriaUseCase` | — | 5 | P1 | `__tests__/application/acessar-via-token.usecase.spec.ts` |
| RF03 | `AutenticarUsuarioUseCase` | — | 5 | P1 | `__tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF04 | `AutenticarUsuarioUseCase` | — | 5 | P1 | `__tests__/application/autenticar-usuario.usecase.spec.ts` |
| RF05 | `RegistrarVistoriaUseCase` | RF-VIST-001, RF-VIST-005 | 5 | P1 | `__tests__/application/registrar-vistoria.usecase.spec.ts` |
| RF06 | `AnexarFotoUseCase` | RF-GRV-002 | 5 | P1 | `__tests__/application/anexar-foto.usecase.spec.ts` |
| RF07 | `AnexarFotoUseCase` | — | 5 | P1 | `__tests__/application/anexar-foto.usecase.spec.ts` |
| RF08 | `GerarRelatorioUseCase`, `AvaliarDesempenhoUseCase` | RF-GRV-001, RF-GRV-004 | 5 | P1 | `__tests__/application/avaliar-desempenho.usecase.spec.ts` |
| RF09 | `SincronizarFilaUseCase` | RF-GRV-003 | 5 | P1 | `__tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF10 | `SincronizarFilaUseCase` | RF-GRV-003 | 5 | P1 | `__tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF11 | todos os use cases de escrita | RF-SYNC-001 | 5 | P1 | specs dos use cases |
| RF12 | `SincronizarFilaUseCase` | RF-SYNC-002 | 5 | P1 | `__tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF13 | `SincronizarFilaUseCase` | RF-SYNC-003 | 5 | P1 | `__tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF14 | `SincronizarFilaUseCase` | RF-SYNC-004 | 5 | P1 | `__tests__/application/sincronizar-fila.usecase.spec.ts` |
| RF15 | `GerarRelatorioUseCase`, `ConsultarHistoricoUseCase` | — | 5 | P1 | `__tests__/application/consultar-historico.usecase.spec.ts` |
| RF16 | `ConsultarHistoricoUseCase`, `DevolverVistoriaUseCase` | — | 5 | P1 | `__tests__/application/consultar-historico.usecase.spec.ts` |
| RF17 | `RegistrarVistoriaUseCase`, `RealizarAutoAvaliacaoUseCase` | RF-VIST-007 | 5 | P1 | `__tests__/application/realizar-autoavaliacao.usecase.spec.ts` |
| RF18 | `AnotarVistoriaUseCase` | — | 5 | P1 | `__tests__/application/anotar-vistoria.usecase.spec.ts` |
| RF19 | `AprovarVistoriaUseCase` | — | 2/5 | P1 | `__tests__/domain/usuario.entity.spec.ts` |
| RF20 | `RegistrarVistoriaUseCase` | RF-EVI-002 | 5 | P2 | `__tests__/application/registrar-vistoria.usecase.spec.ts` |

---

## 3. Requisitos Não Funcionais (RNF01-RNF19)

RNFs não têm teste unitário próprio: são verificados porconstraint de arquitetura, por teste do comportamento que o garante, ou por inspeção. A coluna "Como verificar" diz qual.

| ID | Restrição | Como verificar | Passo | Prio | Status |
|----|-----------|----------------|-------|------|--------|
| RNF01 | Nenhuma escrita depende de rede | specs de use case com `NetworkGatewayFake` offline | 5 | P1 | ⬜ |
| RNF02 | Permissão no primeiro uso; negada bloqueia sem crash | specs de `CapturarLocalizacaoUseCase` e `AnexarFotoUseCase` com permissão negada | 5 | P1 | ⬜ |
| RNF03 | GPS por sessão, nunca por item | spec de `CapturarLocalizacaoUseCase` | 5 | P1 | ⬜ |
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
| RNF19 | Zero import de React/Expo/SDK em domain e application | **`__tests__/arquitetura/clean-architecture.spec.ts` (passa a existir no Passo 1)** | 1 | P1 | ⬜ |

---

## 4. Casos de Uso (15)

| ID | Use case | Regras | Artefato | Teste | Prio | Status |
|----|----------|--------|----------|-------|------|--------|
| UC01 | `RegistrarVistoriaUseCase` | RF-VIST-001/005, RF-SYNC-001 | `src/application/use-cases/registrar-vistoria.usecase.ts` | `__tests__/application/registrar-vistoria.usecase.spec.ts` | P1 | ⬜ |
| UC02 | `FinalizarVistoriaUseCase` | RF-VIST-002/003/004, RF-SYNC-001 | `src/application/use-cases/finalizar-vistoria.usecase.ts` | `__tests__/application/finalizar-vistoria.usecase.spec.ts` | P1 | ✅ |
| UC03 | `AnotarVistoriaUseCase` | RF-VIST-003/007 | `src/application/use-cases/anotar-vistoria.usecase.ts` | `__tests__/application/anotar-vistoria.usecase.spec.ts` | P1 | ⬜ |
| UC04 | `CapturarLocalizacaoUseCase` | RF-VIST-004, RF-SYNC-001 | `src/application/use-cases/capturar-localizacao.usecase.ts` | `__tests__/application/capturar-localizacao.usecase.spec.ts` | P1 | ⬜ |
| UC05 | `AnexarFotoUseCase` | RF-EVI-001, RF-GRV-002 | `src/application/use-cases/anexar-foto.usecase.ts` | `__tests__/application/anexar-foto.usecase.spec.ts` | P1 | ⬜ |
| UC06 | `SincronizarFilaUseCase` | RF-SYNC-002..010 | `src/application/use-cases/sincronizar-fila.usecase.ts` | `__tests__/application/sincronizar-fila.usecase.spec.ts` | P1 | ⬜ |
| UC07 | `GerarRelatorioUseCase` | RF-GRV-004, RF-SYNC-009 | `src/application/use-cases/gerar-relatorio.usecase.ts` | `__tests__/application/gerar-relatorio.usecase.spec.ts` | P1 | ⬜ |
| UC08 | `AutenticarUsuarioUseCase` | RF-SYNC-004, RF-SEC-001 | `src/application/use-cases/autenticar-usuario.usecase.ts` | `__tests__/application/autenticar-usuario.usecase.spec.ts` | P1 | ⬜ |
| UC09 | `AcessarViaTokenUseCase` | — | `src/application/use-cases/acessar-via-token.usecase.ts` | `__tests__/application/acessar-via-token.usecase.spec.ts` | P1 | ⬜ |
| UC10 | `AvaliarDesempenhoUseCase` | RF-GRV-004/005 | `src/application/use-cases/avaliar-desempenho.usecase.ts` | `__tests__/application/avaliar-desempenho.usecase.spec.ts` | P1 | ⬜ |
| UC11 | `RealizarAutoAvaliacaoUseCase` | RF-VIST-002 | `src/application/use-cases/realizar-autoavaliacao.usecase.ts` | `__tests__/application/realizar-autoavaliacao.usecase.spec.ts` | P1 | ⬜ |
| UC12 | `AssinarVistoriaUseCase` | — | `src/application/use-cases/assinar-vistoria.usecase.ts` | `__tests__/application/assinar-vistoria.usecase.spec.ts` | P1 | ⬜ |
| UC13 | `AprovarVistoriaUseCase` | RF19 | `src/application/use-cases/aprovar-vistoria.usecase.ts` | `__tests__/application/aprovar-vistoria.usecase.spec.ts` | P1 | ⬜ |
| UC14 | `DevolverVistoriaUseCase` | RF-VIST-002/003 | `src/application/use-cases/devolver-vistoria.usecase.ts` | `__tests__/application/devolver-vistoria.usecase.spec.ts` | P1 | ⬜ |
| UC15 | `ConsultarHistoricoUseCase` | RF-SEC-002 | `src/application/use-cases/consultar-historico.usecase.ts` | `__tests__/application/consultar-historico.usecase.spec.ts` | P1 | ⬜ |

> `CriarVistoriaUseCase` e seu spec hoje existentes são absorvidos por UC01 no Passo 5 (D-02).

---

## 5. Telas e Adaptadores

| Artefato | Passo | Prio | Teste | Status |
|----------|-------|------|-------|--------|
| `src/adapters/context/auth-context.tsx` | 6 | P1 | `__tests__/adapters/auth-context.spec.tsx` | ⬜ |
| `src/adapters/hooks/use-auth.ts` | 6 | P1 | `__tests__/adapters/use-auth.spec.tsx` | ⬜ |
| `src/adapters/hooks/use-ocorrencias.ts` | 6 | P1 | `__tests__/adapters/use-ocorrencias.spec.tsx` | ⬜ |
| `src/adapters/screens/login.screen.tsx` | 7 | P1 | `__tests__/adapters/login.screen.spec.tsx` | ⬜ |
| `src/adapters/screens/vistoria-form.screen.tsx` | 7 | P1 | `__tests__/adapters/vistoria-form.screen.spec.tsx` | ⬜ |
| `src/adapters/screens/historico-relatorios.screen.tsx` | 7 | P1 | `__tests__/adapters/historico-relatorios.screen.spec.tsx` | ⬜ |
| `src/adapters/screens/assinatura.screen.tsx` | 7 | P2 | `__tests__/adapters/assinatura.screen.spec.tsx` | ⬜ |
| `src/adapters/screens/dashboard.screen.tsx` | 7 | P1 (RNF08) | `__tests__/adapters/dashboard.screen.spec.tsx` | ⬜ |
| `src/adapters/auth/session-storage.securestore.ts` | 8 | P1 | `__tests__/adapters/session-storage.securestore.spec.ts` (com `jest.mock`) | ⬜ |
| `src/adapters/gateways/camera.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/camera.gateway.fake.spec.ts` | ⬜ |
| `src/adapters/gateways/location.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/location.gateway.fake.spec.ts` | ⬜ |
| `src/adapters/gateways/auth.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/auth.gateway.fake.spec.ts` | ⬜ |
| `src/adapters/gateways/sync.gateway.fake.ts` | 4 | P1 | `__tests__/adapters/sync.gateway.fake.spec.ts` | ⬜ |
| `src/adapters/repositories/*.inmemory.ts` | 4/5 | P1 (T-02) | `__tests__/adapters/*.inmemory.spec.ts` | ⬜ |

---

## 6. Cobertura exigida

| Camada | Meta | Ferramenta | Como é medida |
|--------|------|------------|---------------|
| `src/domain/**` | **≥90%** | Jest | `coverageThreshold` no `jest.config.js` — pendência T-01 |
| `src/application/**` | **≥80%** | Jest | idem |
| `src/adapters/**` | cobertura de mapeamento | Jest | idem |
| Telas e hooks | **≥80%** | `@testing-library/react-native` | idem |

Nenhum teste toca câmera, GPS, autenticação ou Supabase reais: são sempre fakes (regra de ouro da apresentação §5).

---

## 7. Pendências abertas

| ID | Pendência | Bloqueia |
|----|-----------|----------|
| D-06 | Onde a gravidade mora: `ItemChecklist` ou `Vistoria` | Passo 2 |
| C-01 | Desfecho da 5ª tentativa de sync | Passo 3 |
| C-02 | Política de estouro da fila | Passo 3 |
| C-03 | Sync com usuário revogado | Passo 5 |
| C-04 | Sessão expirada com rascunho local | Passo 5/6 |
| C-05 | Retry em erro 4xx versus 5xx | Passo 3 |
| C-06 | Token de convite reusado ou expirado | Passo 5 |
| C-07 | Arquivo de evidência removido pelo SO | Passo 2 |
| C-08 | Relógio do dispositivo incorreto | Passo 3 |
| C-09 | Logout com itens pendentes na fila | Passo 5 |
| T-01 | `jest.config.js` sem `jest-expo` nem `coverageThreshold` | Passo 1 |
| T-02 | Repositórios in-memory sem teste | Passo 5 |
| T-03 | Artefatos web do template (violação de §1.1) | qualquer revisão da obrigação |

Detalhamento de cada cenário em `docs/documento-software.md` §1.6 e §0.2.

---

*Documento criado em 29/09/2026 na Fase 0, conforme decisão D-08. É a fonte de conferência manual da rastreabilidade do SindiFlow.*
