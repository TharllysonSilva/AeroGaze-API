# AeroGaze Web

Centro de comando da fazenda (Next.js 15 + Tailwind), seguindo o design system em `aerogaze-web-design-system/`.
Conversa com a API `aerogaze-api`. As chamadas saem do **servidor** do Next: o token fica em cookie `httpOnly` e o navegador nunca o vê (e não há CORS).

## Rodar tudo na sua máquina (4 passos)

Pré-requisitos: Node 22, Docker. Considere as pastas `~/projetos/aerogaze-api` e `~/projetos/aerogaze-web`.

**1. Banco (terminal A)**
```bash
cd ~/projetos/aerogaze-api
docker compose up -d db
```

**2. API (terminal B), primeira vez**
```bash
cd ~/projetos/aerogaze-api
cp .env.example .env            # edite JWT_SECRET
npm install
npm run migrate && npm run seed
npm run start:dev               # http://localhost:3000
```

**3. Worker de prova (terminal C, opcional)**
```bash
cd ~/projetos/aerogaze-api
npm run start:worker:dev
```

**4. Web (terminal D)**
```bash
cd ~/projetos/aerogaze-web
cp .env.example .env            # API_URL=http://localhost:3000
npm install
npm run dev                     # http://localhost:3001
```

Abra http://localhost:3001 e entre com (senha `aerogaze-dev-123`):

| Usuário | Papel | O que vê |
|---|---|---|
| `gerente@demo.aerogaze` | gerente | Comando completo, Frota, Análise, Logística, Auditoria |
| `operador@demo.aerogaze` | operador | Só "Tarefas do dia" |
| `vet@demo.aerogaze` | veterinário | Comando, Telemetria; reconhece e resolve alertas |
| `auditor@demo.aerogaze` | auditor | Comando, Telemetria, Análise, Auditoria |
| `admin@demo.aerogaze` | administrador | Tudo, inclusive Configurações |

Para ver dados na tela, envie eventos pela API (ou pelo app Flutter). Exemplo rápido com curl está no README da API.

## O que já é real e o que ainda não

| Tela | Estado |
|---|---|
| Login, sessão, sair | Real (cookie httpOnly, token de 12 h) |
| Comando | Real: KPIs, mapa dos talhões (polígonos do PostGIS) com eventos, alertas (reconhecer/resolver), tarefas (iniciar/concluir), log de eventos |
| Auditoria | Real: lotes de prova, status, recibo, link de verificação |
| Verificar (`/verificar/<id>`) | Real e **pública** (destino do QR code) |
| Telemetria, Frota, Análise, Logística, Configurações | Aparecem no menu por papel, mas mostram "em construção" e dizem qual módulo da API falta |

## Estrutura

```
aerogaze-web/
├── tailwind.config.ts, styles/tokens.css     design system (fonte única de tokens)
├── middleware.ts                             sem cookie -> /login
├── app/
│   ├── login/                                tela e formulário
│   ├── api/auth/login|logout/route.ts        sessão por cookie httpOnly
│   ├── (app)/layout.tsx                      shell com menu por papel
│   ├── (app)/comando/                        page.tsx + actions.ts (server actions)
│   ├── (app)/auditoria/page.tsx
│   ├── (app)/[secao]/page.tsx                telas "em construção"
│   └── verificar/[id]/page.tsx               verificação pública
├── components/                               Logo, Icon, PlotMap, shell/, ui/
└── lib/                                      api.ts, session.ts, nav.ts (quem vê o quê), format.ts, types.ts
```

## Publicar

* **Vercel** (grátis para demonstração; o plano gratuito é de uso não comercial): importe o repositório e defina `API_URL` com a URL **HTTPS pública** da API. Não precisa mexer em CORS.
* Em produção o cookie é `secure`; use sempre HTTPS na API e na web.
* Troque o `JWT_SECRET` da API e use `AUTO_REGISTER_DEVICES=false` (veja o README da API).

## Limites conhecidos

* O menu esconde o que o papel não vê, mas **a API é quem garante a permissão**; o middleware só verifica a presença do cookie.
* O mapa é vetorial e simples (sem satélite). Troque por Google Maps/MapLibre quando precisar de imagem real.
* Falta rate limit no login (na API) e testes automatizados de interface.

## Ensaio integrado de 12/10/2026

A configuração local `.env.local` aponta para `https://aerogaze-api.onrender.com`; a web é acessível em http://localhost:3001 e usa autenticação real. A conta de integração foi criada na API; a senha fica somente no arquivo local ignorado desse repositório, não é a senha fictícia da tabela de seed acima.

Comando foi conferido com o UUID Flutter `5895a412-4ccb-4823-b51e-e5982c0b6e56` e sua tarefa de revisão humana. O lote `85281cde-c9b5-4664-bdfe-ed7f5465a2db` tem ancoragem Base Sepolia e verificação pública válida. A página pública distingue mock, ancoragem pendente, consulta RPC indisponível e prova EVM efetivamente conferida. Dependências transitivas ainda possuem avisos de audit; não foi aplicada migração major forçada.

Validação: 7 testes de estado da prova, TypeScript e build aprovados; login e Comando autenticados, verificação pública sem login. Para servir o build local, use `npm run build` seguido de `npm run start`; encerre o servidor dev antes de compilar para evitar disputa pelo diretório `.next`. Publicação externa da web não realizada nesta etapa.

Tarefas concluídas continuam visíveis no histórico do Comando; auditor não recebe controles de edição. Alterar o status usa a API protegida e conserva o UUID da inspeção de origem.
