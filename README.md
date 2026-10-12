# AeroGaze API

Back end do AeroGaze AI (NestJS + PostgreSQL/PostGIS). Implementa o fluxo do documento de arquitetura:
evidência offline → sincronização idempotente → talhão (PostGIS) → regra → alerta e tarefa → lote de prova (Merkle) → ancoragem.

## Rodar na sua máquina

```bash
cd ~/projetos/aerogaze-api
cp .env.example .env            # edite JWT_SECRET
docker compose up -d db         # PostgreSQL 16 + PostGIS
npm install
npm run migrate                 # cria as tabelas
npm run seed                    # fazenda demo, talhões, usuários e aparelho
npm run start:dev               # API em http://localhost:3000
npm run start:worker:dev        # (outro terminal) monta e ancora os lotes de prova
```

Usuários do seed (senha `aerogaze-dev-123`): `operador@`, `vet@`, `gerente@`, `auditor@`, `admin@` + `demo.aerogaze`.
Aparelho demo: `device-demo-01`.

## Testes

```bash
npm test                                    # unitários (Merkle, JSON canônico)
TEST_DATABASE_URL=postgresql://aerogaze:aerogaze_dev@localhost:5432/aerogaze_test npm test
```
O banco de teste precisa terminar em `_test` (é zerado a cada execução). Crie-o uma vez:
`docker compose exec db psql -U aerogaze -c "CREATE DATABASE aerogaze_test"`.
Os testes de aceite cobrem: sincronização sem duplicar, geofence (borda e GPS impreciso), isolamento entre organizações, papéis, aparelho revogado, adulteração detectada e operação com a blockchain fora do ar.

## Endpoints

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| GET | `/health` | público | health check |
| POST | `/v1/auth/login` | público | devolve `accessToken` (JWT) |
| POST | `/v1/sync/events` | operador, veterinário, gerente, admin | **recebe o outbox do Flutter** |
| GET | `/v1/farms`, `/v1/farms/:id/plots` | autenticado | fazendas e talhões (GeoJSON) |
| POST | `/v1/farms/:id/plots` | gerente, admin | cria talhão/piquete (GeoJSON Polygon) |
| GET | `/v1/alerts`, `/v1/tasks` | autenticado | listas para app e dashboard (`?farmId=&status=`) |
| PATCH | `/v1/alerts/:id/status`, `/v1/tasks/:id/status` | conforme papel | atualiza status |
| GET | `/v1/events` | vet, gerente, auditor, admin | linha do tempo de eventos |
| GET | `/v1/proof/batches` | auditor, gerente, admin | lotes de prova |
| GET | `/v1/proof/batches/:id/events/:eventId` | auditor, gerente, admin | prova de inclusão de um evento |
| GET | `/v1/verify/:batchId` | **público** (QR code) | integridade do lote, sem expor dados |

## Contrato de sincronização (lado Flutter)

```http
POST /v1/sync/events
Authorization: Bearer <accessToken>

{
  "farmId": "<uuid da fazenda>",
  "deviceId": "device-demo-01",
  "events": [{
    "id": "<UUID v4 gerado no aparelho>",
    "type": "inspection.recorded",
    "schemaVersion": 1,
    "occurredAt": "2026-10-07T12:30:00Z",
    "payload": {
      "location": { "lat": -12.645, "lon": -55.823, "accuracyM": 6 },
      "ai": { "label": "mancha_de_folha", "confidence": 0.91, "modelVersion": "tflite-0.1" }
    }
  }]
}
```

Resposta (sempre 200, um recibo por evento):

```json
{ "acks": [{ "id": "...", "status": "accepted" }], "summary": { "accepted": 1, "duplicate": 0, "rejected": 0 } }
```

Regras para o outbox do Drift: marque `Sincronizado` quando o status for `accepted` **ou** `duplicate`; `rejected` fica
visível com o `reason`; erro de rede/timeout/5xx = mantenha pendente e tente de novo (é seguro reenviar).
Posições de ativos usam `type: "position.reported"` com `payload.assetId` e `payload.location`.

## Regras implementadas

* **RG-IA-01**: inferência alta confiança e não saudável → alerta + tarefa. `inconclusivo` ou confiança baixa → só tarefa de revisão humana.
* **RG-GEO-01**: N leituras consecutivas, precisas, fora da margem de todos os polígonos e com permanência mínima → alerta + tarefa.
* Alertas abertos não se repetem (`dedupe_key`).

## Publicar (resumo; passo a passo na conversa)

Mesma imagem Docker para dois serviços: **API** (comando padrão, aplica migrações) e **worker** (`node dist/worker`).
Variáveis em produção: `DATABASE_URL`, `JWT_SECRET` (32+ caracteres), `NODE_ENV=production`,
`AUTO_REGISTER_DEVICES=false`, `CORS_ORIGIN=https://seu-dashboard`. Health check: `/health`.

## Segurança: o que já está e o que falta

Já: JWT + papéis, isolamento por organização/fazenda em toda consulta, eventos append-only (trigger), idempotência por UUID,
aparelho revogável, auditoria de login/sync/status, nenhum segredo em código.
Falta antes de produção real: limite de requisições no login (rate limit), `helmet`, assinatura dos eventos pela chave do
aparelho, rotação de segredo/secret manager, backups testados, observabilidade (OpenTelemetry) e revisão de LGPD.

## Custo de blockchain e agrupamento

Cada lote vira UMA transação na rede. `BATCH_MIN_EVENTS` e `BATCH_MAX_AGE_MIN` controlam quando o lote fecha
(em produção, algo como 50 eventos ou 60 minutos; use 1440 para um lote por dia).

## Aviso sobre a ancoragem

`ANCHOR_MODE=mock` gera recibo **simulado**: a raiz só existe neste banco, então não prova nada para terceiros.
Para prova real, use `ANCHOR_MODE=evm` com o contrato do pacote `aerogaze-chain`.

## Integração Flutter → Comando → prova

`inspection.recorded` com `payload.captureMode="manual"` gera uma tarefa de revisão humana sem atribuir resultado a IA. A ingestão continua idempotente por UUID e exige a fazenda autorizada no token.

`GET /v1/sync/events/:eventId/receipt` exige autenticação e retorna `{eventId, ingestion, tasks, batch}`. `batch=null` significa que o worker ainda não formou o lote; ingestão e ancoragem são estados separados. A consulta valida organização e fazenda antes de expor o recibo. `/v1/tasks` inclui `source_event_id` para correlacionar a tarefa exibida no Comando.

A verificação pública continua em `/v1/verify/:batchId`. Com RPC indisponível, `onChain.checked=false` não confirma a rede e não significa adulteração. A UI deve exigir `checked=true`, `matches=true`, `revoked=false`, modo EVM e status ancorado para mostrar confirmação externa. O transporte RPC usa timeout de 15 segundos por requisição ([FetchRequest](https://docs.ethers.org/v6/api/utils/fetching/)).

### Ensaio local isolado

O helper `node scripts/start-integration-api.cjs` inicia a porta 3302 com banco **aerogaze_android_test** em **127.0.0.1:55432**, credenciais descartáveis e ancoragem **mock**. Ele valida o alvo antes de migrar/seed. É exclusivo de desenvolvimento; não configura ancoragem real nem substitui a validação em testnet.

### Nova conta de integração

`scripts/provision-integration-user.cjs` confere o banco Neon pela fazenda/prova já publicada. Sem argumentos, só confere. `--create` cadastra `gerente.integracao@demo.aerogaze` como gerente restrito à fazenda e gera senha aleatória no arquivo `.env.integration.local`, ignorado pelo Git. Contas existentes não são sobrescritas. A conexão do banco e a senha nunca são impressas.

Validação em 12/10/2026: build aprovado e **55 testes passando** em PostgreSQL/PostGIS exclusivo de teste, incluindo isolamento do recibo, inspeção manual, queda/retorno do RPC e verificação pública. Não executar os testes de aceite sobre o banco publicado.
