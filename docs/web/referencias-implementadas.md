# Web conforme as referências — 13/10/2026

Alteração exclusiva da web. Os fontes canônicos ficam em files/aerogaze-web/aerogaze-web, sincronizados por scripts/sync-web.ps1 para web/ neste repositório. O APK e os fontes mobile não foram alterados.

Vistas: Comando, dispositivos IoT (Telemetria), Frota, Análise, Logística, Galeria de Inspeções, Visão Térmica, Timeline e Configurações. Auditoria e verificações públicas Base/Solana foram preservadas. Menu de 320px e conteúdo compartilham a mesma largura; navegação horizontal e painéis empilhados em telas menores.

ReferencePanels usa os mesmos server actions e endpoints existentes. Os comandos mantêm UUID para repetir uma tentativa sem duplicar o evento. Não há confirmação otimista de comando: a resposta da API e a leitura do cenário são necessárias. Tarefas e alertas reais continuam usando os formulários existentes no Comando. Conta/fazenda e permissões continuam validadas no servidor.

Imagens ilustrativas vieram dos assets dos arquivos code.html das nove referências exportadas pelo usuário em Downloads/aerogazeIA/stitch_agriherd_ai_platform. Foram armazenadas localmente em public/scenario para evitar dependência do host de imagens. Não representam imagens capturadas na fazenda. Polígonos e estados vêm da API; séries, animais e posições permanecem fictícios. Saúde calculada é a proporção de animais saudáveis do cenário, sem alegação de produtividade real. Não há previsão científica, correlação, NDVI de satélite ou inferência de IA nova.

Configurações mostram a unidade e o perfil autenticados. Preferências salvas por fazenda no navegador controlam visibilidade dos alertas, exportação JSON e aviso de contingência. Cadastro de novos operadores, edição de organização e troca de chaves não são inventados pela interface. Credenciais e chaves privadas permanecem no servidor.

Validação: TypeScript aprovado; sete testes de prova aprovados. Todas as nove vistas abriram em navegador autenticado contra a API publicada, sem imagens quebradas e sem sobreposição do menu no desktop. Busca e seleção de animais conferidas. Preferência de contingência foi salva, recuperada após reload e restaurada. Corte do cabeçalho estreito corrigido; excesso de largura de 4px na timeline identificado e corrigido antes da publicação.

Ensaio de comandos na nova UI: retorno do drone gerou evento 06ec19ae-572f-4559-ab0f-42b049801706 e envio gerou 673d687c-f6b5-4722-ba59-46335edba2b2. Ambos confirmados pela API e exibidos na timeline. Estado final: missão e bateria 88%, igual ao estado inicial. São operações do cenário simulado; não controlam equipamento físico. Não se afirma neste ensaio que esses dois eventos já foram ancorados.

Conferência final: todas as nove vistas em 390px ficaram sem excesso horizontal após a correção da timeline. Busca por BR-004 exibiu uma única linha e temperatura formatada 38,6 °C. Exportação JSON validada como simulated=true, com telemetry e state v15. Galeria, térmica e timeline são acessadas pelas abas da telemetria; o menu principal mantém a estrutura das referências e a Auditoria existente.
