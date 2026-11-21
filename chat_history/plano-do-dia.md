# Plano do Dia — SindiFlow

**Data:** 20/11/2026  
**Fase:** Sprint 0 — Estabilização do boot, composição e limpeza do auth antigo  
**Objetivo:** fazer o app voltar a iniciar, remover o modo demo do caminho de produção e deixar uma base verificável para o próximo bloco.

**Decisão de autenticação:** o login Google será mantido, mas com SDK nativo e Supabase como backend — sem navegador. O fluxo é `Google nativo → idToken → supabase.auth.signInWithIdToken()`.

---

## Check-in §8

O plano anterior de 29/09/2026 foi substituído por decisão do responsável nesta data. O novo plano começa com todos os itens em `⬜` e será atualizado conforme a execução.

Legenda: `✅ concluído · 🟡 em andamento · ⬜ não iniciado`

---

## Plano de execução

| # | Bloco | Camada | Teste primeiro | Status |
|---|-------|--------|----------------|--------|
| 1 | Baseline: instalar dependências e rodar os gates | — | — | ✅ |
| 1.5 | Harness confiável: imports, tipos, mocks e duplicatas | Testes | — | ✅ |
| 2 | RED do boot: composition root e provider sem demo | Infra / Adapters | Sim | ✅ |
| 3 | GREEN do boot: remover crash, seed e `limpar()` | Infra / Adapters | — | ✅ |
| 4 | Google: remover caminho browser-based e preparar adapter nativo | Adapters | Sim | 🟡 |
| 5 | Fechamento: gates, plano e mensagem de commit | — | — | 🟡 |

---

## Bloco 1 — Baseline

**Objetivo:** saber exatamente o que está quebrado antes de corrigir.

Comandos:

```bash
npm ci
npm test
npm run coverage
npm run typecheck
npm run lint
```

Regras:

- Não alterar código antes de registrar a linha de base.
- Se `npm ci` falhar por lockfile, parar e pedir decisão antes de mexer no `package-lock.json`.
- Registrar os erros reais, incluindo os que já são esperados por inspeção estática.

**Saída:** lista objetiva de falhas dos quatro gates.

**Resultado em 20/11/2026:**

- `npm test`: 13 suites falharam / 28 passaram; 8 testes falharam / 291 passaram.
- `npm run typecheck`: 30 erros em 10 arquivos.
- `npm run lint`: 23 problemas (14 erros, 9 warnings).
- Cobertura: `domain` branches 89,47% (< 90%) e `adapters` branches 52,9% (< 60%).
- A maioria das suítes vermelhas falha antes de executar por erro de import/tipo/mock, não por comportamento ausente.

---

## Bloco 1.5 — Harness confiável

**Objetivo:** fazer o vermelho restante representar comportamento real, não erro de teste.

Correções:

- imports com profundidade errada em `__tests__/infra/db/*` e `__tests__/application/autenticar-usuario.usecase.spec.ts`;
- tipo inválido em `usuario.repository.sqlite.spec.ts`;
- mock de `upsert()` no `sync-gateway.supabase.spec.ts`;
- seed do outbox antes de `marcarSincronizado` ou remoção da suíte duplicada;
- consolidação das suítes duplicadas de ocorrência/outbox;
- remoção do fake SQLite de `src/`, mantendo os duplos em `__tests__/fakes/`;
- testes obsoletos de demo removidos de `gestao-vistoria-papeis.spec.ts`.

**Saída:** suítes compilam e os vermelhos restantes são de comportamento real.

---

## Bloco 2 — RED do boot

**Objetivo:** escrever o teste que reproduz o crash atual antes da correção.

Testes a criar:

- `composition root` não semeia dados, não limpa tabelas e não depende de efeito colateral no escopo do módulo;
- provider renderiza sem crash quando não há usuário demo automático;
- estado de rede vem do serviço real, não de um `setOnline` manual.

Camadas: `infra` para composição; `adapters` para o provider/contexto; nenhum import de Expo/SQLite em `domain` ou `application`.

**Saída:** teste falhando pelo motivo certo — crash no boot, seed indevido ou dependência não injetada.

---

## Bloco 3 — GREEN do boot

**Objetivo:** fazer o app iniciar sem crash e sem demo no fluxo normal.

Correções, na ordem:

1. Remover a chamada `AutenticarUsuarioUseCase.obterPerfisDemonstracao()` do caminho de produção.
2. Remover `popularMockInicial()` do boot normal.
3. Remover `vistoriaRepo.limpar()`, `ocorrenciaRepo.limpar()` e `outboxRepo.limpar()`.
4. Extrair a composição para `src/infra/composition-root.ts` ou `src/adapters/context/`, sem abrir banco/instanciar tudo no escopo do módulo.
5. Derivar `isOnline` de `NetworkServiceReal`; remover `networkService.setOnline(false)`.
6. Remover o fallback de credenciais Supabase `https://exemplo.supabase.co`; sem env, falhar com mensagem clara.
7. Ajustar telas que assumem `usuarioLogado` sempre presente para suportar o estado nulo.

Regra para demonstração:

- Se ainda for necessária para as telas, a demo fica atrás de `__DEV__ && EXPO_PUBLIC_DEMO_MODE=1`.
- O seed deve ser idempotente (`INSERT OR IGNORE`) e gravar no SQLite, nunca apagar tabelas.
- O fluxo normal de produção não pode criar vistoria, ocorrência ou usuário demo sozinho.

**Saída:** app inicia sem crash, não apaga dados e não cria dados demo no boot.

---

## Bloco 4 — Google sem navegador

**Objetivo:** remover a implementação browser-based e preparar o caminho nativo + Supabase.

Decisão:

- Manter o requisito de login Google.
- Remover `expo-auth-session` e `expo-web-browser` do caminho de código.
- Manter a porta `AuthGateway` no domínio.
- O adapter Google usa SDK nativo e entrega o `idToken` ao `AutenticarUsuarioUseCase`.
- O use case troca o token por sessão Supabase com `signInWithIdToken`.
- O login exige rede; a sessão fica no `SecureStore` e permite uso offline por até 7 dias.

Biblioteca:

- Preferência: `react-native-nitro-google-signin`.
- Fallback: `@react-native-google-signin/google-signin`, se o Nitro não validar em React Native 0.88.1.
- A escolha final depende de spike em development build; não é possível validar em Expo Go.

Se o spike não couber hoje:

- Deixar `AuthGatewayGoogle` como adapter explícito de “não configurado”, sem browser e sem simular login.
- Não declarar o Google pronto até o fluxo funcionar em Android/iOS com ID token aceito pelo Supabase.

**Saída:** nenhum caminho de browser no código; contrato e adapter prontos para o spike nativo.

---

## Bloco 5 — Fechamento

- Rodar `npm test`, `npm run typecheck` e `npm run lint` nos arquivos tocados.
- Atualizar este plano com os status reais.
- Preparar a mensagem de commit; **não commitar** — §4.4.
- Registrar pendências: Google nativo em device, sync real, RF-VIST-001, docs e cobertura.

---

## Bloco 4 — Google (status atual)

- ✅ `AuthGateway` e `GoogleSignInGateway` separados; `AutenticarUsuarioUseCase` com `metodo: 'email' | 'google'`.
- ✅ `AuthGatewaySupabase` usa `signInWithIdToken`, `SecureStore` e validação estrita de role/condomínio.
- ✅ `SupabaseAuthStorage` chunked (480 code points) para evitar limite do Keychain.
- ✅ Adapter nativo `GoogleSignInGatewayNative` com `react-native-nitro-google-signin` (`GoogleOneTapSignIn`).
- ✅ `app.json`: package/bundle id `com.sindiflow.app`, plugin Nitro com placeholder `iosUrlScheme`, `newArchEnabled` removido (SDK 58).
- ✅ `expo-auth-session` removido das dependências.
- ✅ `expo-doctor`: 20/20 checks passando.
- ⬜ Desenvolvimento build e login real em device: pendente de Android SDK, Google Cloud SHA-1 e env reais.
- ⬜ Compatibilidade do Nitro com RN 0.88.1: não verificada em build nativo.

## Bloco 5 — Fechamento (resultados)

- `npm test`: 43 suites / 338 testes, todos passando.
- `npm run typecheck`: 0 erros.
- `npm run lint`: 0 problemas.
- `npm run coverage`: gates de `domain` (90%), `application` (80%), `adapters` (70%/60%) e `infra` (70%/60%) atendidos.
- `npm ci`/`npm install`: dependências atualizadas para SDK 58 via `expo install --fix`.
- Android prebuild (`npx expo prebuild --platform android --no-install --clean`): sucesso; `react-native-nitro-google-signin` autolinkado.

## Fora de escopo hoje

- Login Google real em device/development build.
- `SyncGatewaySupabase` em produção.
- Migrações SQLite completas.
- RF-VIST-001, RF-VIST-005/006.
- Limpeza geral de README/rastreabilidade.
- Novas telas ou polish.

---

## Critérios de aceite do dia

- [ ] `npm ci` executado e baseline registrado.
- [ ] Teste de boot escrito antes da correção.
- [ ] App inicia sem crash.
- [ ] Nenhum `limpar()`/seed demo no boot de produção.
- [ ] `setOnline` removido do caminho real.
- [ ] `expo-auth-session`/`expo-web-browser` fora do código.
- [ ] `plano-do-dia.md` atualizado.
- [ ] Mensagem de commit pronta; commit pendente — ação do usuário.

---

## Bloqueios e riscos

| ID | Bloqueio | Resolve em |
|----|----------|------------|
| B-01 | `node_modules` ausente; gates ainda não executados | Bloco 1 |
| B-02 | `AutenticarUsuarioUseCase.obterPerfisDemonstracao()` não existe no código | Bloco 3 |
| B-03 | Repositórios SQLite não têm `limpar()`; o boot atual chama esses métodos | Bloco 3 |
| B-04 | `NetworkServiceReal` não tem `setOnline()` | Bloco 3 |
| B-05 | `AuthGatewayGoogle` atual usa API incompatível e importa `expo-web-browser` | Bloco 4 |
| B-06 | Google nativo exige development build, Google Cloud e provider configurado no Supabase | Próximo bloco |
| B-07 | Compatibilidade do Nitro com React Native 0.88.1 precisa de spike | Bloco 4 / próximo |
| B-08 | Supabase sem URL/key/schema/RLS confirmados | Configuração externa |
| B-09 | Lei §7 ainda diz Expo SDK 57, enquanto §1.1 e o projeto usam SDK 58 | Revisão formal da lei |

---

## Mensagem de commit prevista

```text
feat(auth): native Google login with Supabase and stabilized boot

- extract composition root and remove module-scope side effects
- remove demo profile bootstrap and destructive seed from production boot
- derive connectivity from expo-network
- remove browser-based Google auth path and expo-auth-session
- add native Google Sign-In gateway (react-native-nitro-google-signin)
- add SecureStore-backed Supabase session storage with chunking
- persist and rehydrate checklist items in VistoriaRepositorySQLite
- add config and device-id adapters; boot with placeholders in dev
- configure Expo SDK 58 app.json for Nitro Google Sign-In
- update law §7 to Expo SDK 58 / React Native 0.88.1

Revisado conforme obrigações.md §4.2
```

**Commit pendente — ação do usuário.**

---

## Referências

- **Obrigações:** `agent_tools/sindiflow-obrigacoes.md` v1.3.0
- **Rastreabilidade:** `docs/rastreabilidade.md`
- **Documento de software:** `docs/documento-software.md`
- **Plano da fase:** `chat_history/presentation-06-10-26.md`
- **Auditoria recente:** `chat_history/2026-11-10.md`

---

*Plano criado em 20/11/2026. Substitui o plano de 29/09/2026 por decisão do responsável. Execução ainda não iniciada.*
