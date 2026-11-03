# SindiFlow — Roteiro de Fala da Apresentação (10 Minutos)
**Projeto:** Implementação de Câmera, Geolocalização & Persistência Local SQLite  
**Palestrante:** Inspetor / Engenheiro de Software SindiFlow  
**Tempo Total:** 10:00 minutos  

---

## ⏱️ Cronômetro e Mapa dos Slides

| Slide | Título do Slide | Tempo | Destaque Técnico |
| :---: | :--- | :---: | :--- |
| **01** | **Câmera, Geolocalização & Persistência Local** | 0:00 - 1:00 | Abertura, proposta de valor e rigor pericial |
| **02** | **O Problema e a Solução Pericial** | 1:00 - 2:15 | NBR 5674, "vistorias de gabinete", subsolos |
| **03** | **Clean Architecture & DDD: Onde Moram Câmera e GPS?** | 2:15 - 3:45 | **Onde entra a Câmera e o GPS mandatório** |
| **04** | **Como Testamos sem Hardware Físico? (TDD)** | 3:45 - 5:00 | Inversão de dependência e Gateways Fakes |
| **05** | **O Domínio e as Interfaces (A Base do Contrato)** | 5:00 - 6:15 | `ICameraGateway`, `ILocationGateway`, sem Base64 |
| **06** | **O Teste (TDD na Prática): 25 Suítes, 100% GREEN** | 6:15 - 7:30 | Jest 30, caminhos felizes, bloqueios e erros |
| **07** | **APIs Modernas do Expo: A Infraestrutura se Adequa** | 7:30 - 8:45 | `expo-image-picker`, `expo-location` (High Accuracy) |
| **08** | **Salvando Câmera e GPS no Banco de Dados Local (SQLite)** | 8:45 - 9:30 | SQLite como fonte da verdade, transação e Outbox |
| **09** | **Conclusão: Robustez de Engenharia para Campo Real** | 9:30 - 10:00 | Fechamento e chamada para perguntas / demo |

---

## 🎙️ Roteiro de Fala Passo a Passo (Slide a Slide)

### Slide 1: Abertura e Apresentação
**⏱️ Tempo:** 0:00 a 1:00 (1 minuto)  
**🎯 Objetivo:** Cumprimentar a banca/público, situar o projeto e dar o tom profissional da apresentação.

> *"Olá a todos. Hoje apresentamos a implementação dos módulos de Câmera, Geolocalização e Persistência Local no SindiFlow.*  
> *Nosso foco nesta apresentação de 10 minutos é demonstrar como resolvemos problemas críticos de idoneidade pericial em campo utilizando rigor técnico de engenharia de software:*  
> *1. Clean Architecture com isolamento total do Domínio;*  
> *2. Desenvolvimento orientado a testes (TDD) prévio a qualquer linha de código;*  
> *3. Armazenamento local robusto em SQLite no próprio dispositivo móvel, garantindo operação 100% offline em subsolos."*

---

### Slide 2: O Problema e a Solução Pericial
**⏱️ Tempo:** 1:00 a 2:15 (1 min e 15s)  
**🎯 Objetivo:** Explicar a dor real das vistorias prediais e como o software resolve.

> *"O grande desafio das vistorias prediais é a idoneidade jurídica. Hoje, o mercado sofre com as chamadas 'vistorias de gabinete': laudos preenchidos à distância sem que o perito tenha pisado nas áreas críticas do condomínio.*  
> *Além disso, garagens no subsolo (G2 e G3) são verdadeiras gaiolas de Faraday sem sinal de internet ou 4G, e fotos em galerias comuns podem ser facilmente manipuladas.*  
> *No SindiFlow, Câmera e Geolocalização não são recursos cosméticos: são **invariantes de domínio** da norma NBR 5674.*  
> *O sistema bloqueia a finalização se o perito não registrar o GPS de presença física e exige foto pericial obrigatória para qualquer anomalia de gravidade ALTA, operando com total autonomia offline."*

---

### Slide 3: Clean Architecture & DDD: Onde Moram Câmera e GPS?
**⏱️ Tempo:** 2:15 a 3:45 (1 min e 30s) — ⭐ **SLIDE CHAVE**  
**🎯 Objetivo:** Explicar com extrema clareza ONDE a Câmera entra e ONDE o GPS mandatório entra.

> *"Aqui está o coração arquitetural do nosso projeto. O erro comum em apps mobile é importar 'expo-camera' ou 'expo-location' dentro de telas ou da lógica de negócio. No SindiFlow, o Domínio não faz a menor ideia de que o Expo existe.*  
>  
> *E onde exatamente entram a Câmera e o GPS?*  
>  
> *• **A CÂMERA entra no Item de Checklist e nas Ocorrências Críticas:** Ela é modelada como um Value Object puro chamado `Evidencia`. A foto comprova visualmente a avaria do equipamento inspecionado e é obrigatória para ocorrências de gravidade alta com SLA de 24h. A imagem física fica salva em disco no FileSystem compactada em no máximo 1080p, com seu Hash SHA-256 indexado no SQLite.*  
>  
> *• **O GPS MANDATÓRIO entra na Sessão de Vistoria (RF-VIST-004):** Conforme a regra §1.4, o GPS **não é capturado solto por foto** para não dispersar coordenadas. Ele entra na **Finalização da Vistoria**. O método `vistoria.finalizar(geolocalizacao)` possui uma trava de domínio: é impossível fechar o laudo sem a leitura do satélite. O GPS é a **Assinatura Pericial de Presença Física**, provando juridicamente que o engenheiro esteve no condomínio no momento da assinatura.*  
>  
> *A infraestrutura é quem se adapta ao Domínio através das interfaces `ICameraGateway` e `ILocationGateway`. Se amanhã trocarmos de biblioteca, o Domínio não muda uma única linha."*

---

### Slide 4: A Estratégia de TDD: Como Testamos sem Hardware Físico?
**⏱️ Tempo:** 3:45 a 5:00 (1 min e 15s)  
**🎯 Objetivo:** Mostrar a maturidade do processo de TDD e como testamos hardware sem depender do aparelho.

> *"Um dos grandes pilares do projeto é o TDD. Mas como testar Câmera e GPS em servidores de integração contínua (CI/CD) onde não existe um ser humano segurando um celular?*  
> *Graças à Inversão de Dependência, criamos Fakes Determinísticos: `CameraGatewayFake` e `LocationGatewayFake`.*  
> *Nos testes de Casos de Uso, simulamos em memória cenários felizes, cancelamento do usuário ao abrir a câmera, recusa de permissão e perda de sinal de GPS, executando em centenas de milissegundos.*  
> *Já nos testes dos Adaptadores, validamos que as chamadas às APIs nativas do Expo respeitam os contratos, garantindo foco por toque, alta precisão de satélite e tratamento de exceções."*

---

### Slide 5: O Domínio e as Interfaces (A Base do Contrato)
**⏱️ Tempo:** 5:00 a 6:15 (1 min e 15s)  
**🎯 Objetivo:** Exibir os contratos TypeScript e a proteção contra anti-patterns (como Base64 na memória).

> *"Vejam os contratos formais em código TypeScript puro.*  
> *Na interface `ICameraGateway`, o resultado da captura é uma **união discriminada**: `{ status: 'sucesso' }`, `{ status: 'cancelado' }` ou `{ status: 'erro' }`. O usuário fechar a câmera sem tirar foto não é uma falha de sistema, é um fluxo alternativo que o compilador nos obriga a tratar.*  
> *Na `FotoCapturada`, temos URI do arquivo, dimensões e Hash SHA-256 de integridade. Não há qualquer menção a Base64, cumprindo rigorosamente a obrigação §1.4 e evitando estouro de memória no celular.*  
> *E na `ILocationGateway`, exigimos latitude, longitude, precisão em metros e timestamp de satélite."*

---

### Slide 6: O Teste (TDD na Prática): 25 Suítes, 100% GREEN
**⏱️ Tempo:** 6:15 a 7:30 (1 min e 15s)  
**🎯 Objetivo:** Comprovar a qualidade com métricas reais de execução dos testes.

> *"Aqui está a evidência factual do nosso TDD: **25 suítes de testes automatizados e 259 testes unitários rodando com 100% de sucesso no Jest**.*  
> *O que nossos testes garantem?*  
> *1. Que o aggregate `Vistoria` recusa finalizar se a geolocalização estiver ausente (RF-VIST-004);*  
> *2. Que o checklist bloqueia finalização se menos de 80% dos itens forem inspecionados (RF-VIST-002);*  
> *3. Que fotos anexadas geram hash SHA-256 e são associadas ao item correto sem perda;*  
> *4. Que se o perito cancelar a câmera, a vistoria permanece intacta sem erros silenciosos.*  
> *Essa cobertura nos dá a tranquilidade de alterar código sabendo que nenhuma invariante pericial será violada."*

---

### Slide 7: A Implementação da Infraestrutura (Os Adaptadores Expo)
**⏱️ Tempo:** 7:30 a 8:45 (1 min e 15s)  
**🎯 Objetivo:** Apresentar a implementação técnica real com as APIs modernas do ecossistema Expo SDK 58.

> *"Agora olhando para a camada externa: como a infraestrutura realiza o contrato?*  
> *Criamos os adaptadores `CameraGatewayExpo` e `LocationGatewayExpo`.*  
> *Para a Câmera, utilizamos `launchCameraAsync` do `expo-image-picker`. Ela aciona a câmera nativa do sistema operacional (Android ou iOS) com suporte a foco por toque, HDR e compressão de imagem antes de entregar o arquivo.*  
> *Para a Geolocalização, usamos `expo-location` com `Accuracy.High`, requisitando as coordenadas diretamente dos chips de GPS e satélites GLONASS/Galileo do smartphone.*  
> *O adaptador faz o mapeamento das estruturas do Expo para os objetos de domínio puros do SindiFlow, sem vazar nada para as camadas internas."*

---

### Slide 8: Salvando os Dados no Banco Local (SQLite Offline)
**⏱️ Tempo:** 8:45 a 9:30 (45 segundos)  
**🎯 Objetivo:** Destacar o armazenamento offline no SQLite e a fila transacional Outbox.

> *"Por fim, o armazenamento. Conforme a Seção 1.2 das obrigações do projeto, o SQLite é a **fonte única da verdade offline**.*  
> *Toda coordenada de GPS da sessão é gravada na tabela `vistorias` junto com data, inspetor e precisão em metros.*  
> *As fotos são registradas na tabela `fotos_evidencia` guardando a URI local do `FileSystem` e o hash SHA-256 — **zero Base64 no banco de dados**, mantendo o app leve e rápido.*  
> *Toda escrita ocorre dentro de transações atômicas com enfileiramento na tabela `outbox_events`, pronta para sincronizar com a nuvem via retry exponencial assim que o perito sair do subsolo."*

---

### Slide 9: Encerramento & Conclusão
**⏱️ Tempo:** 9:30 a 10:00 (30 segundos)  
**🎯 Objetivo:** Fechar com chave de ouro, resumir a entrega e abrir para perguntas e demonstração prática.

> *"Em conclusão:*  
> *Entregamos um aplicativo onde a **Câmera** comprova o dano com integridade física; a **Geolocalização** comprova a presença pericial do engenheiro no condomínio; e o **SQLite local** garante que nenhuma informação se perca, mesmo a 3 andares abaixo do solo.*  
> *O código respeita rigorosamente a Clean Architecture, o DDD e os princípios de TDD.*  
> *Muito obrigado pela atenção, e estamos abertos para perguntas e para demonstrar o app funcionando ao vivo no dispositivo!"*

