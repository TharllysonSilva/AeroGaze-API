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
