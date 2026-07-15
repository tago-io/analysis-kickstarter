# 🚨 Alertas

## 💡 O que é um Alerta?

Um **Alerta** é uma regra que monitora seus sensores e notifica as pessoas certas no momento em que algo precisa de atenção — um freezer esquentando, uma porta deixada aberta, um
compressor que parou ou um sensor que ficou em silêncio. Cada alerta é restrito a uma **organização**, então usuários de um tenant só veem (e só recebem) os alertas que pertencem a
eles.

Você pode criar quantos alertas precisar, combinar diferentes seleções de sensores e personalizar a mensagem enviada para que o destinatário saiba exatamente o que aconteceu e
onde.

## 🛠️ O que posso fazer neste dashboard?

Este dashboard lista todos os alertas configurados para a organização que você abriu.

- 📋 **Por Sensor — Lista de Alertas** — Uma tabela com todos os alertas: quais sensores são monitorados, o modelo (Temperatura, Porta, Compressor, Inatividade), a condição, o
  valor, os destinatários e a mensagem. A partir daqui, você pode:
  - **Excluir** um alerta (o ícone de lixeira em _Controles_). A exclusão é irreversível — a regra é removida e nenhuma notificação adicional é disparada por ela.
- 🌐 **Alertas Globais** — Uma aba somente leitura mostrando os padrões para toda a aplicação (usados quando uma organização não tem uma regra de Inatividade específica).
- ➕ **Criar Alerta** — Abre o formulário para adicionar um novo alerta. Você escolhe quais sensores monitorar, o modelo, a condição, os destinatários e a mensagem.

## 🧩 Os quatro tipos de alerta

| Modelo             | O que monitora                             | Exemplo de condição                                      |
| ------------------ | ------------------------------------------ | -------------------------------------------------------- |
| 🌡️ **Temperatura** | A variável `temperature` do sensor         | `> 80°F`, `< 20°F`, `entre 30-40°F`, `= 50°F`, `!= 60°F` |
| 🚪 **Porta**       | A variável `door` (aberta/fechada)         | `door = open`                                            |
| ⚙️ **Compressor**  | A variável `compressor` (ligado/desligado) | `compressor = off`                                       |
| ⏰ **Inatividade** | Quanto tempo desde o último uplink         | `sem dados por 2 horas`                                  |

Temperatura está sempre em **°F**. Porta e Compressor são enums escolhidos em um dropdown. Inatividade é medida em horas.

## ✉️ A mensagem de notificação

A mensagem é enviada **dentro da aplicação** (o ícone de sino no topo do dashboard) para cada destinatário escolhido. Você pode personalizá-la com placeholders que são substituídos
no momento em que o alerta dispara:

- `#device_name#` — o nome amigável do sensor
- `#device_id#` — o ID interno do sensor
- `#sensor_type#` — a tag de tipo do sensor (por exemplo, `freezer`)
- `#value#` — o valor que ultrapassou o limite
- `#variable#` — o nome da variável que disparou (por exemplo, `temperature`)

Exemplo: _"Freezer 02 está quente demais: temperatura chegou a #value#°F"_ vira _"Freezer 02 está quente demais: temperatura chegou a 84°F"_.

## ⚙️ Como funciona por trás dos panos

Cada alerta é um registro lógico no **device da organização**, escrito como seis variáveis compartilhando o mesmo `group` (que serve também como ID do alerta). A tabela do widget
lê essas linhas diretamente — é por isso que um alerta novo aparece na tabela logo após ser criado.

Para alertas de **Temperatura, Porta e Compressor**, a função de analysis `createAlert` também provisiona uma **Action** TagoIO do tipo `condition`:

1. ✅ Valida os campos do formulário com um schema Zod (modelo, condição, valor, destinatários, mensagem).
2. 💾 Escreve as seis variáveis do alerta no device da organização, agrupadas por um novo ID de alerta.
3. 🏷️ Se o alerta tem como alvo sensores específicos, marca cada sensor escolhido com `alert_id = <alertID>` para que a Action possa encontrá-los pela tag.
4. 🎬 Cria uma Action TagoIO cujo trigger casa com _todo device da organização_ (`device_type = device`) ou _apenas os sensores com a tag `alert_id` correspondente_.
5. 📨 A Action chama a analysis `alert-dispatcher` sempre que a condição é atendida. O dispatcher lê o registro do alerta, substitui os placeholders e envia a notificação in-app a
   cada destinatário.

Alertas de **Inatividade** funcionam de forma diferente — eles NÃO são apoiados por uma Action TagoIO (a plataforma não consegue detectar nativamente "sem dados por X horas"). Em
vez disso, a analysis agendada `check-inactive-sensors` roda periodicamente, lê as regras de Inatividade de cada organização e dispara as notificações usando os destinatários e a
mensagem por organização.

O fluxo de exclusão é o inverso: remove as seis variáveis do device da organização, remove a tag `alert_id` de qualquer sensor que estivesse marcado para ele e exclui a Action
TagoIO (quando existe).

## ❓ Perguntas frequentes

**Qual a diferença entre _Todos os Sensores_ e _Sensores_ em "Configurar alertas por"?** _Todos os Sensores_ faz o alerta monitorar todos os sensores atualmente na organização,
incluindo qualquer sensor adicionado depois — o trigger da Action é a tag `device_type = device`. _Sensores_ permite escolher uma lista específica; apenas os sensores marcados são
tagueados e monitorados.

**Se eu criar um alerta para Todos os Sensores e adicionar um sensor novo depois, ele será coberto?** Sim, automaticamente — porque a Action filtra pela tag `device_type`, que todo
sensor da organização já tem.

**Por que não vejo uma Action criada para o meu alerta de Inatividade?** É por design. Inatividade é detectada por uma varredura agendada, não por uma Action de condição do TagoIO.
A regra é armazenada no device da organização e lida a cada execução da analysis `check-inactive-sensors`.

**Os destinatários recebem e-mail ou SMS?** Não — apenas notificações in-app (o sino no topo do dashboard). E-mail e SMS estão fora do escopo deste template.

**O que acontece com notificações antigas se eu excluir um alerta?** Notificações já enviadas permanecem na caixa do destinatário; apenas as notificações futuras param. Excluir o
alerta remove a regra, a linha na tabela, a Action (se houver) e a tag `alert_id` dos sensores monitorados.

**Dois alertas podem mirar o mesmo sensor?** Sim — um sensor pode ser monitorado por quantos alertas você quiser, e cada um dispara de forma independente.

## 💎 Dicas

- Use placeholders na mensagem para que o mesmo template de alerta funcione para todos os sensores. _"#device_name# reportou #variable# = #value#"_ é mais útil que um texto
  estático.
- Para Temperatura _Entre_, defina primeiro o limite inferior e depois o superior. O alerta dispara quando o valor cai **dentro** do intervalo.
- Alertas de Inatividade são ótimos como rede de segurança: mesmo que um alerta específico de Temperatura ou Porta esteja faltando, uma regra de Inatividade pega sensores que
  simplesmente pararam de reportar.
- Prefira um alerta de _Todos os Sensores_ a criar um alerta separado por sensor — é mais fácil de manter e cobre automaticamente os sensores adicionados depois.
- Mantenha a lista de destinatários enxuta. Fadiga de notificação faz com que alertas importantes sejam ignorados.
