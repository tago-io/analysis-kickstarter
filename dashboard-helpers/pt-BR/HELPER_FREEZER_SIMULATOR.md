# 🔍 Simulador de Freezer

## 💡 O que é este dashboard?

O dashboard **Simulador de Freezer** é a visão detalhada de um único sensor. Você chega aqui clicando no ícone **Visualizar** ao lado de um sensor no dashboard de Sensores — não há
entrada na sidebar porque ele sempre precisa de um sensor específico no escopo.

## 🛠️ O que posso fazer neste dashboard?

O cabeçalho mantém os seletores de breadcrumb (Organização, Grupo, Sensor) preenchidos a partir do deep-link, então você sempre sabe qual sensor está vendo. O dashboard tem duas
abas:

- 📊 **Aba Visão Geral** — a visualização padrão, composta de três áreas:
  - **Monitor de Câmara Fria ao Vivo** (custom widget) — três cards grandes no topo: _TEMPERATURA_ (gauge + valor em °F), _STATUS DO COMPRESSOR_ (LIGADO/DESLIGADO) e _STATUS DA
    PORTA_ (ABERTA/FECHADA). Cada card mostra um rótulo "— X min atrás" para que você saiba de relance se o valor está atualizado.
  - **Tabela de Histórico do Sensor** — uma lista paginada das últimas leituras com as colunas _Temperatura_, _Status da Porta_, _Status do Compressor_ e _Data e Hora_. A tabela
    carrega até 1.000 registros, paginados; navegue pelas páginas para ver uplinks mais antigos.
  - **Histórico de Temperatura (botão do cabeçalho)** — abre um gráfico de linha de 24 horas da temperatura em uma modal sobre o dashboard. Suporta drag-to-zoom; um botão _Resetar
    Zoom_ volta para a janela completa. Use quando precisar identificar tendências, quedas ou aquecimentos que um único valor não consegue mostrar.
- 📘 **Aba Helper** — este documento.

## ⚙️ Como funciona por trás dos panos

Não existe um _device_ de dashboard por sensor — o dashboard lê diretamente o próprio device do sensor. O deep-link da tabela de Sensores define `sensor_dev=<sensorID>` na URL, e
todo widget desta página é vinculado a esse escopo através dos Blueprints do TagoIO.

- Os três **cards ao vivo** do Cold Room Monitor são alimentados pelos últimos valores das variáveis `temperature`, `compressor` e `door` do device do sensor. O custom widget
  formata os valores e calcula o rótulo "X minutos atrás" a partir do timestamp de cada valor.
- A **tabela de Histórico do Sensor** consulta essas mesmas variáveis no device do sensor, ordenadas por tempo decrescente. É uma tabela TagoIO comum, e é por isso que paginação e
  contagem total de registros funcionam de forma nativa.
- O **gráfico de Histórico de Temperatura** é um widget Line Chart vinculado à variável `temperature` no device do sensor, configurado para as últimas 24 horas.

Como cada widget lê o device do sensor diretamente, nenhuma analysis roda quando você abre este dashboard. Os dados que você vê foram escritos pela analysis `uplink-handler` (e
pelo decoder) quando o sensor enviou seus uplinks.

## ❓ Perguntas frequentes

**Por que este dashboard não está na sidebar?** Ele só faz sentido para um sensor por vez, e esse sensor vem dos parâmetros da URL definidos pelo dashboard de Sensores. Sem esse
escopo, o dashboard não teria nada para renderizar, então o acesso é intencionalmente feito apenas pelo ícone **Visualizar**.

**Os cards mostram "— Xh atrás" com um número grande. O que isso significa?** O sensor não envia um uplink há esse tempo. É o mesmo sinal que a aba Câmaras Frias usa no dashboard
de Grupos. Verifique a conectividade do device (rede, bateria) se o tempo continuar subindo.

**Por que o gráfico de Histórico de Temperatura só cobre 24 horas?** Ele é configurado para uma janela de 24 horas porque combina com a pergunta operacional mais comum (_"o que
esse freezer fez hoje?"_).

**Posso editar o sensor a partir daqui?** Não — esta é uma visão operacional somente leitura. Para renomear ou excluir o sensor, volte ao dashboard de Sensores e use os controles
da linha.

**Minha tabela está vazia mesmo que os cards mostrem dados. Por quê?** Os cards leem o valor _mais recente_, enquanto a tabela consulta os últimos 1.000 ordenados por tempo. Se
você acabou de provisionar o sensor e apenas um uplink chegou, a tabela terá uma única linha.

## 💎 Dicas

- Use a modal de Histórico de Temperatura como sua primeira parada ao investigar um alerta: um gráfico normalmente responde a _"isso é um pico ou um problema sustentado?"_ mais
  rápido que rolar a tabela.
- A tabela de Histórico do Sensor alinha _Temperatura_, _Status da Porta_ e _Status do Compressor_ na mesma linha, então é o lugar certo para correlacionar eventos — por exemplo,
  para verificar se um pico de temperatura coincidiu com a porta abrindo ou o compressor desligando.
- O rótulo `— X min atrás` é o seu check de saúde mais rápido. Dois dos três cards atrasados normalmente indica que o próprio sensor está offline; um card sozinho normalmente
  indica problema de decoder ou payload.
