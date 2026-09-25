# Planejamento Completo: Fase "Domínio e Interface Primeiro"
**Projeto: SindiFlow — Inspetor Offline**
**Data: 06/10/2026**
**Status: 100% Mock / 80%+ Cobertura**

---

## Visão Geral da Abordagem

Nesta etapa inicial, o desenvolvimento segue um fluxo estritamente incremental e desacoplado:
**Domínio → Use Cases → Context API e Sessão Segura → Componentes/Telas com Fakes**,
tudo testado com TDD antes que qualquer dado toque em um banco de dados permanente
(SQLite ou Supabase).

---

## 1. Camada de Domínio Puro (domain/)

O domínio contém as regras de negócio centrais e é **100% puro**, sem qualquer importação ou dependência do React, Expo ou bibliotecas de UI.

### Value Objects (Objetos de Valor)
Tipos imutáveis, sem identidade própria e validados na criação:

| Value Object | Descrição | Regras de Negócio |
|-------------|-----------|-------------------|
| `Gravidade` | Armazena tipo (ALTA/MÉDIA/BAIXA) e calcula a faixa de SLA (24h/72h/7d) | RF08: ALTA 24h, MÉDIA 72h, BAIXA 7 dias |
| `Coordenada` | Armazena latitude, longitude e marca temporal (timestamp) | RF-VIST-004: geolocalização obrigatória, validação de range |
| `Assinatura` | Representa a assinatura digital (token + timestamp) | RF02: convite por e-mail, token expira 24h |
| `SLAData` | Valida horas totais, mínimas e do período por gravidade | RF08: regra de SLA por tipo de ocorrência |
| `StatusSincronizacao` | Enum (`pending` \| `synced` \| `error`) | RF11-RF14: controle de fila outbox |
| `StatusVistoria` | Enum do ciclo de vida de negócio da ocorrência | RF-VIST-001: RASCUNHO → FINALIZADA → BLOQUEADA |

### Entidades e Agregados (Entities & Aggregate Roots)

**`Ocorrencia` (Aggregate Root):**
- Agrupa e gerencia o ciclo de vida das `FotoEvidencia`, `ItemChecklist` e assinaturas
- Protege invariantes de negócio:
  - Bloqueia o registro de uma nova ocorrência se o período já estiver como FINALIZADA
  - Valida se podeFinalizar() apenas com ≥80% dos itens marcados (RF-VIST-002)
  - Bloqueia finalização se houver item CRÍTICO sem justificativa (RF-VIST-003)
  - Requer geolocalização obrigatória para ocorrência ser válida (RF-VIST-004)

**`Usuario` (Aggregate Root):**
- Entidade com raiz e ciclo de vida próprio
- Acesso via sessão com token (expiração e revogação sem conta de autenticação padrão)
- Cache seguro de dados do usuário (non-PII) em SQLite (RF04)
- Sessão offline de 7 dias (RF01)

**`FotoEvidencia`:**
- Compõe `Ocorrencia` (acessada através do agregado, nunca isoladamente)
- Gerencia URI local, URL remota e status de upload
- Obrigatória para ALTA, recomendada para MÉDIA, opcional para BAIXA (RF06)

**`ItemChecklist`:**
- Compõe `Ocorrencia`
- Status de verificação (PENDENTE → CONCLUIDO)
- Template fixo ou configurável por condomínio (RF17)
- Categorias: Elétrica, Incêndio, Hidráulica (RF18)

### Serviços de Domínio (Domain Services)
Regras cruzadas que envolvem mais de um agregado:

| Domain Service | Responsabilidade |
|---------------|-----------------|
| `RegraGeracaoRelatorioService` | Regras de geração de relatórios PDF (RF15) |
| `RegraDevolucaoService` | Regras de devolução/rollback de ocorrência (RF-VIST: rollback) |
| `SincronizacaoService` | Resolução de conflito (last-write-wins por `updated_at`), retry, consistência (RF11-RF14) |

### Contratos e Interfaces (Ports)
Definição puramente declarativa das interfaces de repositórios e gateways:

| Interface | Tipo | Responsabilidade |
|-----------|------|------------------|
| `OcorrenciaRepository` | Repository | CRUD para Ocorrencia |
| `FotoEvidenciaRepository` | Repository | CRUD para FotoEvidencia |
| `ItemChecklistRepository` | Repository | CRUD para ItemChecklist |
| `UsuarioRepository` | Repository | Cache local de sessão (sem persistência persistente) |
| `CameraGateway` | Gateway | Interface de câmera (expo-camera) |
| `LocationGateway` | Gateway | Interface de geolocalização (expo-location) |
| `AuthGateway` | Gateway | Interface de autenticação (Supabase Auth) |
| `SyncGateway` | Gateway | Interface de sincronização com Supabase |

---

## 2. Camada de Aplicação (application/use-cases/)

Contém a lógica de orquestração do sistema. Os casos de uso chamam as entidades do domínio e se comunicam através das interfaces dos repositórios e gateways, sem conter regras de negócio puras ou código de interface.

### Casos de Uso Implementados

| Use Case | Descrição | RF Relacionada |
|----------|-----------|----------------|
| `RegistrarOcorrenciaUseCase` | Cria nova ocorrência com status PENDENTE, salva localmente | RF05-RF07 |
| `FinalizarVistoriaUseCase` | Transiciona Ocorrencia para FINALIZADA se ≥80% marcados | RF-VIST-002 |
| `AnotarVistoriaUseCase` | Adiciona observação a Ocorrencia (necessário para CRITICO) | RF-VIST-003 |
| `CapturarLocalizacaoUseCase` | Chama LocationGateway para capturar lat/lng | RF-VIST-004 |
| `AnexarFotoUseCase` | Chama CameraGateway para capturar e fazer upload de foto | RF06-RF07 |
| `SincronizarFilaUseCase` | Processa SyncQueue, envia para Supabase, resolve conflitos | RF11-RF14 |
| `GerarRelatorioUseCase` | Gera relatório PDF com filtros (status/data/condomínio) | RF15 |
| `ConsultarHistoricoUseCase` | Consulta histórico de ocorrências de uma vistoria | RF16 |
| `AutenticarUsuarioUseCase` | Login/logout com Supabase Auth + sessão cacheada 7 dias | RF01-RF04 |
| `AcessarViaTokenUseCase` | Acesso via token com expiração e revogação | RF02-RF03 |
| `AvaliarDesempenhoUseCase` | Validação de desempenho da ocorrência (critérios de qualidade) | RF-VIST |
| `RealizarAutoAvaliacaoUseCase` | Autoavaliação de itens do checklist | RF17-RF18 |
| `AssinarVistoriaUseCase` | Assinatura digital do relatório de vistoria | RF-VIST: assinatura |
| `AprovarVistoriaUseCase` | Aprovação da ocorrência por supervisor | RF-VIST |
| `DevolverVistoriaUseCase` | Devolução/rollback da ocorrência | RF-VIST |

### Testes com Fakes In-Memory
Todos os use cases são testados via TDD com implementações fake em memória:
- `PeriodoAvaliacaoRepositoryFake` utiliza `Map` para simular o banco
- `CameraGatewayFake` retorna URI mockada
- `LocationGatewayFake` retorna coordenadas fixas
- `AuthGatewayFake` devolve sessões válidas
- Cobertura do caminho feliz, tratamento de erros e falta de permissões sem dependência externa

**Meta de Cobertura: 80%+ para a camada de aplicação**

---

## 3. Camada de Adaptadores, Estado Global e Context API (adapters/)

Esta camada residem a Context API, o armazenamento de sessão local e a integração entre o ciclo de vida do React Native e os Casos de Uso.

### Context API (adapters/context/AuthContext.tsx)
- **Localização Arquitetural**: Fica na camada de Adapters/UI. O domínio e a camada de aplicação **nunca** importam a Context API.
- **Responsabilidade**: Elimina o Prop Drilling do usuário autenticado (Aluno, Orientador ou Coordenação). O componente `<AuthProvider>` envolve a raiz do aplicativo e disponibiliza o estado da sessão globalmente, permitindo que qualquer tela leia o usuário logado com `useContext`.

### Gerenciamento de Sessão Segura (adapters/auth/SessionStorageSecureStore.ts)
- Implementa a interface `SessionStorage` atuando como um wrapper sobre a biblioteca `expo-secure-store`.
- Criptografa o token de sessão diretamente no dispositivo (Keychain no iOS / Keystore no Android), evitando o uso de armazenamento não seguro.
- **Meta**: Garantir RNF06 (Segurança) com token em `expo-secure-store` (nunca `AsyncStorage` puro).

### Custom Hooks de Ponte (adapters/hooks/)
Hooks como `useAuth` e `useAtividades` atuam como a fronteira entre as telas e os Use Cases:
- Adaptam os Casos de Uso ao ciclo de vida do componente React (gerenciando estados como idle, salvando, salvo)
- **Não acoplam** as telas diretamente aos Use Cases
- Permitem injeção de dependência para testes com fakes

### Gateways de Hardware (Adapters)
**CameraGatewayExpo**:
- Embrulha a biblioteca nativa `expo-camera` atrás da interface declarada no domínio
- Mantém a câmera desacoplada para facilitar os testes
- Implementa compressão máx 1080p (RF07)

**LocationGatewayExpo**:
- Embrulha a biblioteca nativa `expo-location` atrás da interface declarada no domínio
- Captura localização por sessão de vistoria (não por item)

**AuthGatewaySupabase**:
- Embrulha `@supabase/supabase-js` para autenticação
- Sessão persistida em `expo-secure-store`

---

## 4. Camada de Interface do Usuário e Rotas (app/ e adapters/screens/)

### Navegação e Rotas (Expo Router - app/)
A estrutura de arquivos em `app/` (ex.: `app/login.tsx`, `app/(aluno)/atividades.tsx`) funciona como a fronteira de entrada visual (Boundary), onde as interações de toque do usuário entram no aplicativo.

### Layouts e Componentes Visuais
- Construídos com componentes nativos `<View>` e `<Text>`
- Estilizados via `StyleSheet` e `Flexbox` (com eixos configurados em `flexDirection: column` por padrão)
- **Sem dependência de bibliotecas de UI externas** (mantido nativo puro)

### Telas Principais

| Tela | Descrição | RF Relacionada |
|------|-----------|----------------|
| `LoginScreen` | Login/logout com Supabase Auth | RF01-RF04 |
| `OcorrenciaFormScreen` | Formulário de ocorrência com checklist, câmera, geolocalização | RF05-RF07 |
| `HistoricoRelatoriosScreen` | Listagem de vistorias com filtros (status/data/condomínio) | RF15-RF16 |
| `AssinaturaScreen` | Assinatura digital do relatório | RF-VIST: assinatura |
| `DashboardScreen` | Dashboard com indicadores de status de sync | RNF08 |

---

## 5. O que FICA EM MOCK / FAKE nesta fase (Sem Banco ou Hardware Real)

Para garantir o **isolamento total** e testes ultrarrápidos, os seguintes componentes permanecem **mockados ou em memória**:

### ❌ Sem Armazenamento Permanente Real
- **Nenhuma** conexão ativa com banco SQLite local (`expo-sqlite`)
- **Nenhuma** conexão com banco relacional em nuvem (`@supabase/supabase-js`)
- Todos os repositórios utilizam estruturas `Map` em memória para simular CRUD

### ❌ Sem Acesso Nativo a Sensores
- As chamadas para APIs de Câmera (`expo-camera`) usam **Gateways Fakes/Mocks** em ambiente de teste
- As chamadas para APIs de Localização (`expo-location`) usam **Gateways Fakes/Mocks** em ambiente de teste
- Nenhuma integração real com hardware de câmera ou GPS nos testes automatizados

### ❌ Fakes de Repositório & Session Stubs
- Uso de estruturas `Map` em memória para repositórios
- Stubs de autenticação devolvendo sessões válidas para montagem das telas
- `CameraGatewayFake` retorna URI mockada
- `LocationGatewayFake` retorna coordenadas fixas

### ✅ Regra de Ouro
> **Nenhum dado real toca banco permanente ou hardware nativo nesta fase.**
> A infraestrutura real (SQLite, Supabase, expo-camera, expo-location) será implementada na Fase seguinte, **após** o domínio estar 100% testado e validado.

---

## 6. Estratégia de Testes e Cobertura (Meta 80%+)

A suíte de testes é organizada de acordo com a pirâmide de testes do projeto:

### Pirâmide de Testes

| Camada | Volume | Tipo | Ferramenta | Meta Cobertura |
|--------|--------|------|------------|----------------|
| **Domínio** | Maior volume | Unitários puros (sem mocks) | Jest (`jest-expo`) | **≥90%** |
| **Use Cases** | Volume alto | Com fakes in-memory | Jest + `@testing-library/react-native` | **≥80%** |
| **Context API & Hooks** | Volume médio | Integração com Use Cases | Jest + `@testing-library/react-native` | **≥80%** |
| **Telas/Componentes** | Volume médio | RNTL (render, fireEvent) | `@testing-library/react-native` + jest-expo | **≥80%** |
| **E2E** | Pouquíssimos | Fluxos críticos completos | Detox (opcional) | — |

### Detalhamento por Tipo de Teste

**1. Testes de Domínio (Maior Volume)**
- Testes unitários puros de Entidades e Value Objects
- Rodam 100% em memória e **sem necessidade de mocks**
- Exemplos: `Gravidade` rejeita tipo inválido, `Coordenada` rejeita lat/lng fora de range, `Ocorrencia.marcarPendente()` valida regras de negócio
- **Meta: ≥90% cobertura**

**2. Testes de Use Cases (Volume Alto)**
- Validação das regras de orquestração e fluxos alternativos
- Injetam repositórios e gateways fakes em memória via TDD (Red-Green-Refactor)
- Cobrem: caminho feliz, tratamento de erros, falta de permissões, geolocalização indisponível
- **Meta: ≥80% cobertura**

**3. Testes do Context API & Hooks (Volume Médio)**
- Validação do `AuthProvider` e do hook `useAuth`
- Garantem o carregamento da sessão salva e a integração com os Use Cases de login
- Testam fluxo sem rede, sessão expirada, permissão negada
- **Meta: ≥80% cobertura**

**4. Testes de Telas e Componentes (RNTL + jest-expo)**
- Testes com `@testing-library/react-native` que usam `render()`, `fireEvent.press` e `fireEvent.changeText` para simular ações do usuário
- Telas envolvidas pelo `<AuthProvider>` com Use Cases Fakes injetados
- Cobrem interação de usuário, estados de loading/erro/permissão
- **Meta: ≥80% cobertura**

**5. Testes E2E (Pouquíssimos)**
- Reservados para fluxos críticos completos (login → registrar ocorrência offline → reconectar → confirmar sincronizado)
- Detox ou Maestro, somente no final do projeto

### Regras de Mock nos Testes
- **Câmera e geolocalização nunca** são exercitadas de verdade em teste automatizado (dependem de hardware)
- Sempre via **gateway mockado/fake**
- A integração real é validada manualmente ou em Detox rodando em device/simulador
- Cada RF deve ter pelo menos um teste que comprove aceitação (rastreabilidade RF → caso de uso → teste)

---

## 7. Checklist Sequencial de Construção

A ordem exata de implementação sugerida para a equipe de desenvolvimento é:

### Passo 1: Value Objects (testes puros)
- `Gravidade` (ALTA/MÉDIA/BAIXA + SLA)
- `Coordenada` (lat/lng com validação de range)
- `Assinatura` (token + timestamp)
- `SLAData` (horas totais, mínimas, período)
- `StatusSincronizacao` (pending/synced/error)
- `StatusVistoria` (RASCUNHO/FINALIZADA/BLOQUEADA)

### Passo 2: Entities & Aggregates (invariantes testadas)
- `Ocorrencia` (Aggregate Root — protege invariantes de negócio)
- `Usuario` (sessão cacheada 7 dias, revogação)
- `FotoEvidencia` (compõe Ocorrencia, upload status)
- `ItemChecklist` (compõe Ocorrencia, template por condomínio)

### Passo 3: Domain Services (regras cruzadas)
- `RegraGeracaoRelatorioService`
- `RegraDevolucaoService`
- `SincronizacaoService`

### Passo 4: Interfaces de Repository / Gateway (contratos definidos no domínio)
- `OcorrenciaRepository`
- `FotoEvidenciaRepository`
- `ItemChecklistRepository`
- `UsuarioRepository`
- `CameraGateway`
- `LocationGateway`
- `AuthGateway`
- `SyncGateway`

### Passo 5: Use Cases (orquestração com fakes in-memory)
- `RegistrarOcorrenciaUseCase`
- `FinalizarVistoriaUseCase`
- `AnotarVistoriaUseCase`
- `CapturarLocalizacaoUseCase`
- `AnexarFotoUseCase`
- `SincronizarFilaUseCase`
- `GerarRelatorioUseCase`
- `AutenticarUsuarioUseCase`
- Todos com testes TDD (Red-Green-Refactor)

### Passo 6: Context API + Custom Hooks
- `AuthContext` (elimina prop drilling)
- `useAuth` (ponte entre telas e Use Cases)
- `useAtividades` (gerenciamento de estado de atividades)

### Passo 7: Telas com RNTL (Use Cases Fakes injetados)
- `LoginScreen`
- `OcorrenciaFormScreen`
- `HistoricoRelatoriosScreen`
- Testes com `@testing-library/react-native`

### Passo 8: Sessão Segura (Adapter)
- `SessionStorageSecureStore` (wrapper sobre `expo-secure-store`)
- **Mockado nos testes** — nenhuma integração real nesta fase

---

## Requeritos Obrigatórios da Fase

### ✅ 100% Mock / Fake
- Nenhum dado real em SQLite, Supabase ou hardware nativo
- Todos os repositórios em `Map` in-memory
- Todos os gateways de hardware com implementações fake
- Nenhuma dependência de SDK externo no domínio ou aplicação

### ✅ 80%+ Cobertura
- Domínio: ≥90%
- Use Cases: ≥80%
- Context API & Hooks: ≥80%
- Telas/Componentes: ≥80%
- Cada RF deve ter pelo menos um teste de aceitação

### ✅ TDD Obrigatório
- Ciclo Red-Green-Refactor para cada implementação
- Teste escrito ANTES do código
- Frase obrigatória no commit: *"Revisado conforme obrigações.md §4.2"*

---

## Rastreabilidade RF → Caso de Uso → Teste

| RF | Caso de Uso | Camada | Teste | Meta Cobertura |
|----|------------|--------|-------|----------------|
| RF-VIST-001..004 | `FinalizarVistoriaUseCase`, `AnotarVistoriaUseCase` | Application | ✅ | ≥90% (Domain) |
| RF01..RF04 | `AutenticarUsuarioUseCase`, `AcessarViaTokenUseCase` | Application | ✅ | ≥80% |
| RF05..RF07 | `RegistrarOcorrenciaUseCase`, `AnexarFotoUseCase` | Application | ✅ | ≥80% |
| RF08..RF10 | `GerarRelatorioUseCase`, `ConsultarHistoricoUseCase` | Application | ✅ | ≥80% |
| RF11..RF14 | `SincronizarFilaUseCase` | Application | ✅ | ≥80% |
| RF15..RF16 | `GerarRelatorioUseCase`, `ConsultarHistoricoUseCase` | Application | ✅ | ≥80% |
| RF17..RF18 | `RealizarAutoAvaliacaoUseCase` | Application | ✅ | ≥80% |

---

## Documentos de Referência
- **Skill base**: `@agent_tools/SKILL.md` — Software Design Document Framework para mobile
- **Obrigações**: `agent_tools/sindiflow-obrigacoes.md` — Lei superior do projeto
- **Histórico**: `chat_history/2026-09-04.md`, `2026-09-07.md`, `2026-09-11.md`, `2026-09-25.md`
- **Apresentação**: `presentation.html` — Mockups e diagramas visuais
- **Este documento**: `chat_history/presentation-06-10-26.md`

---

*Este documento é o planejamento portado para as necessidades do SindiFlow, baseado na estrutura de exemplo recebida. A abordagem "Domínio e Interface Primeiro" com 100% Mock e 80%+ cobertura é a estratégia central desta fase.*
