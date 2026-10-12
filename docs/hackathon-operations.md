# Operação simulada compartilhada

GET `/v1/demo/farms/:farmId` retorna cenário e telemetria explicitamente simulados. POST `/v1/demo/farms/:farmId/actions` exige UUID v4, comando permitido e, quando necessário, animal pertencente ao cenário. Autenticação e escopo de fazenda continuam obrigatórios; auditor só consulta.

Comandos: falhar/reparar/iniciar/parar irrigação, gerar/resolver ocorrência de pragas, enviar/retornar drone, atender/vacinar/mover animal, receber reposição e solicitar apoio. Ações são registradas em eventos imutáveis, histórico e auditoria, com resultado persistente compartilhado pelo app/web. UUID repetido com o mesmo conteúdo recupera a resposta; UUID reutilizado com outro conteúdo é recusado. Falha/ocorrência cria alerta e tarefa; reparo/resolução conclui a tarefa associada. Leituras fictícias não são sensores físicos, satélite ou inferência de IA.

Os eventos entram no outbox existente e podem gerar lotes EVM reais contendo evidências de uma simulação. Não provaram execução física no campo.

## Solana Devnet

POST `/v1/solana/receipts/:eventId` prepara recibo adicional de evento autorizado. GET público `/v1/solana/verify/:eventId` consulta a transação e confere programa Memo, conteúdo, emissor signatário e ausência de erro. O memo contém somente SHA-256 do envelope canônico do evento. Não publica telemetria, organização ou usuário em texto.

Configure no servidor `SOLANA_ENABLED=true`, `SOLANA_RPC_URL=https://api.devnet.solana.com` e `SOLANA_SECRET_KEY` (array JSON de 64 bytes). `scripts/prepare-solana-devnet.cjs` cria a configuração local ignorada sem imprimir chave. Identidade genesis de Devnet é verificada antes de acessar chave. Transação assinada é salva antes do envio; retries usam a mesma assinatura. Expiração sem confirmação exige revisão e não cria nova assinatura automaticamente. RPC indisponível nunca produz confirmação verde.

Integração Memo não é um programa próprio de registro/revogação em Solana, nem prova de execução física. Base continua responsável pelo registro existente de lotes.

## Publicação web

As fontes da web ficam em `web/` neste repositório, preparadas pela lista explícita de `scripts/sync-web.ps1`. Desenvolvimento local permanece na pasta AeroGaze Web original. Sincronize as fontes antes de publicar novas mudanças. Nenhum .env privado é copiado.

No Render, New → Web Service → repositório AeroGaze-API → branch main → Root Directory `web` → runtime Docker → nome `aerogaze-web`. Configure `API_URL=https://aerogaze-api.onrender.com`. O Dockerfile compila Next e usa a porta `PORT` fornecida pelo Render. Alternativamente use o Blueprint `render.yaml` que cria somente o serviço web. Não substitua o serviço API existente.

API publicada precisa do commit com as migrações 002 e 003 antes de abrir as novas seções. Migrações são aplicadas pelo entrypoint existente; não é necessário zerar ou reseedar o banco de nuvem.

## Evidência de nuvem — 12/10/2026

- Ciclo irrigação falha → parada após reparo → irrigando confirmado na API publicada. Eventos `3f9ea442-a610-4147-b7be-b5ae9e8d9351`, `2ee87f82-f8d2-49d3-853d-2e227280eda0` e `535684e8-d818-42cf-b3ee-c07952e9dd57` estão no lote Base Sepolia `98df82dc-9225-4d8b-b2b4-cbab3afbce16`, com valid/checked/matches=true e revoked=false.
- Recibo Solana real de `drone.dispatch`, evento `c47b7ad6-9f75-4207-896b-987ef7eb40ed`: [verificação pública](https://aerogaze-api.onrender.com/v1/solana/verify/c47b7ad6-9f75-4207-896b-987ef7eb40ed), checked/valid=true, status confirmado, simulated=true. [Solana Explorer](https://explorer.solana.com/tx/3gNNiPg5gzB97exawzVqtAfWKKztew4WKxReur7DVeaopBcaAckG6m4rMq14SJNZVmQdppm9mbwf4V5Pu2hGqcBn?cluster=devnet).
- 74 testes API passaram. Imagens API e web passaram em Node 22 Alpine, com npm ci em build e runtime. O lockfile foi regenerado no Linux para conservar `jayson/node_modules/utf-8-validate@5.0.10`, omitido pelo lock produzido no Windows.
- Imagem de produção web respondeu 200 em Comando, Telemetria, Frota, Análise, Logística, Download e Solana público, usando a API publicada. APK público respondeu 200 com 61.800.282 bytes. Publicação externa da web ainda aguardava criação do serviço Render nesta conferência.
- SDK não assina recibos com saldo vazio; espera fundos fictícios sem criar uma assinatura que expire antes do faucet. Recibos antigos que expiraram durante a espera conservam a tentativa original e exigem revisão; não são resignados automaticamente.

## Conferência final publicada

Web publicada em https://aerogaze-web.onrender.com: login, Comando, Telemetria, Frota, Análise, Logística, Download e provas públicas responderam 200 usando a API publicada.

Após publicar API `dbc16d1`, o usuário executou falha e reparo no AeroGaze Dev 0.2.0 do celular. API confirmou estado final `parada`, versão 8, eventos `1733fb24-ae98-41cc-9349-bad241301279` e `c6bbcc39-b018-4d2e-a91e-739a84c369e5` persistidos e tarefa `cce67074-c3a7-4c59-b987-4519dde042eb` concluída. Comando público respondeu 200 e exibiu o reparo e seu evento.

Ambos entraram no [lote Base](https://aerogaze-web.onrender.com/verificar/bc783c4b-6592-4b06-8dc3-601bbe69961f), com valid/checked/matches=true e revoked=false. Os recibos Solana de [falha](https://aerogaze-web.onrender.com/solana/1733fb24-ae98-41cc-9349-bad241301279) e [reparo](https://aerogaze-web.onrender.com/solana/c6bbcc39-b018-4d2e-a91e-739a84c369e5) estão confirmados, checked/valid=true em Devnet. São recibos reais de operações explicitamente simuladas, sem alegação de execução física.
