# Mapas geograficos Google — web

Maps JavaScript substitui os fundos ilustrativos em todos os mapas operacionais da web. API e mobile permanecem inalterados. O mapa inicia ajustado aos poligonos GeoJSON da API e permite ruas/satelite, zoom, arraste, centralizacao da fazenda, localizar um ativo e ir a latitude/longitude. Pontos atualizados pela API nao recentralizam automaticamente a vista do usuario.

Configuracao: adicionar GOOGLE_MAPS_API_KEY ao Environment do servico aerogaze-web no Render. E uma chave Maps destinada ao navegador, entregue pelo layout autenticado em runtime; nao precisa alterar Dockerfile ou rebuild com NEXT_PUBLIC. A chave nunca entra no Git. Para testes locais, o arquivo privado .env.maps.local fica no repositorio API e e carregado somente no processo de validacao.

Google oferece Maps Demo Key sem faturamento para prototipos, com limites diarios e pausa ao atingir a cota. Nao e destinada a producao. Documentacao: https://developers.google.com/maps/documentation/javascript/demo-key . Restrinja uma chave padrao por HTTP referrers e pela Maps JavaScript API; na configuracao disponivel para sua chave, autorize apenas https://aerogaze-web.onrender.com/* e localhost de validacao.

Mapa base e imagem satelite sao do Google; talhoes, animais, drone e irrigacao continuam parte do cenario ficticio. Imagem satelite nao e termografia nem transmissao ao vivo. Nao houve deslocamento ou alteracao dos limites cadastrados, nem envio de eventos novos. As coordenadas GeoJSON sao longitude/latitude e sao convertidas para lat/lng da API Google.

Se a chave estiver ausente ou o carregamento falhar, o componente avisa e mostra somente o esquema dos talhoes, sem fundo fotografico que pudesse aparentar uma localizacao real. Creditos e controles Google permanecem visiveis. Popups usam textContent para nomes provenientes da API.

Validacao: TypeScript aprovado e 9 testes passaram, incluindo coordenadas invertidas, limites geograficos, entradas vazias/invalidas e coordenada zero. Validacao visual e navegacao Google concluidas, conforme registro abaixo.

Validacao com a chave Demo do usuario concluida: satelite real, poligonos alinhados, alternancia ruas/satelite, zoom real 15 para 16, selecao de BR-003 e navegacao para -12.6425,-55.82 confirmados pelo estado visivel e pelo link gerado pelo proprio Google Maps. Centralizacao retornou ao zoom 15. Nenhum evento de operacao foi enviado neste ensaio. Carregador usa callback de prontidao, evitando construir o mapa antes da inicializacao assincrona.

Responsividade conferida em 390px: viewport 390, largura do documento 375, sem excesso horizontal. Todos os mapas operacionais usam o componente compartilhado; a aparencia mobile permanece inalterada.
