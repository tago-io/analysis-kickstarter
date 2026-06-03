# 🧩 Grupos

## 💡 O que é um Grupo?

Um **Grupo** é uma subdivisão dentro de uma Organização. Ele representa uma área física ou lógica onde sensores estão instalados — por exemplo, uma câmara fria, um armazém, uma
linha de produção, um andar ou uma zona. Cada sensor da aplicação pertence a exatamente um grupo, e cada grupo pertence a exatamente uma organização.

Os grupos são a camada que torna grandes implantações gerenciáveis. Em vez de olhar todos os sensores de uma vez, os usuários navegam Organização → Grupo → Sensor, o que mantém
cada tela focada no escopo certo.

## 🛠️ O que posso fazer neste dashboard?

Este dashboard mostra todos os grupos que pertencem à organização selecionada no topo. Ele é dividido em três abas:

- ❄️ **Aba Câmaras Frias** — Uma visualização em tempo real mostrando todos os sensores da organização agrupados pelo grupo pai. Cada grupo é renderizado como um cabeçalho de seção
  com uma contagem (por exemplo, _"5 SENSORES"_) seguido por um card por sensor. Cada card mostra o nome do sensor, o tempo desde o último uplink, a temperatura atual (°F), o
  status do compressor (LIGADO/DESLIGADO) e o status da porta (ABERTA/FECHADA). Um botão de busca no canto superior direito filtra os cards pelo nome do sensor, o que é útil quando
  uma organização tem muitos sensores. Esta é a aba que você deve abrir primeiro quando um usuário quiser saber o estado atual das câmaras frias.
- 🏢 **Seletor de organização** — O dropdown no topo permite alternar entre organizações sem sair deste dashboard. Ele usa o recurso Blueprint do TagoIO: ao mudar a organização,
  todos os widgets são reescritos para mostrar os grupos dela.
- 📋 **Aba Visão Geral — Lista de Grupos** — Uma tabela com o nome e o endereço de cada grupo dentro da organização atual. A partir daqui, você pode:
  - **Visualizar** um grupo (o ícone à esquerda) — abre o dashboard de Sensores já filtrado para aquele grupo.
  - **Editar** o nome do grupo (o ícone de lápis em _Controles_).
  - **Excluir** o grupo (o ícone de lixeira em _Controles_). Excluir um grupo também exclui todos os sensores que pertencem a ele.
- ➕ **Criar Grupo** — Abre um formulário para adicionar um novo grupo à organização atual. Você informa um nome e um endereço; o grupo é criado dentro da organização que você está
  visualizando.

## ⚙️ Como funciona por trás dos panos

Cada grupo é armazenado como um **device** TagoIO do tipo `mutable` com as tags `device_type = group` e `organization_id = <organização pai>`. Esse device armazena os metadados do
grupo (nome, endereço) e atua como âncora para cada sensor que pertence a ele.

Quando você cria um grupo, a função de analysis `createGroup` executa e:

1. ✅ Valida os campos do formulário usando um schema Zod.
2. 🔍 Verifica se o nome é único dentro da organização pai (o mesmo nome é permitido em organizações diferentes).
3. 🏷️ Cria o device, aplica as tags `organization_id`, `group_id` e `device_type` e armazena o endereço como parâmetro do device.

Sensores criados depois carregam a tag `group_id` correspondente, e é assim que a visualização de Sensores deste dashboard sabe o que exibir.

A **aba Câmaras Frias** é alimentada por um **custom widget** TagoIO que lê a variável `cold_room_card_data` do device da organização. Essa variável é escrita pela analysis
`uplink-handler` a cada uplink de sensor: um registro por sensor, agrupado por id de sensor, com metadados de nome do sensor, nome do grupo pai, temperatura, status do compressor e
status da porta. O widget usa o campo `group_name` para agrupar os cards por grupo no momento da renderização — nenhuma query extra é necessária.

## ❓ Perguntas frequentes

**Por que o seletor de organização fica no topo?** Porque este mesmo dashboard é reutilizado para cada organização. O seletor informa ao dashboard qual organização aplicar como
escopo, e o recurso Blueprint recarrega cada widget com os dados daquela organização. Esse é um padrão TagoIO que permite manter uma única configuração de dashboard servindo muitos
tenants.

**Dois grupos podem ter o mesmo nome?** Dois grupos na _mesma_ organização não podem compartilhar nome — a analysis bloqueia. Dois grupos em organizações _diferentes_ podem
compartilhar o nome sem conflito.

**O que acontece se eu excluir um grupo que já tem sensores?** A ação de excluir remove todos os sensores dentro do grupo junto com o device do grupo. A ação é irreversível, então
certifique-se de que está excluindo o grupo certo. Se você quiser apenas mover os sensores para outro grupo, edite os sensores primeiro.

**Por que um card de sensor na aba Câmaras Frias mostra dados antigos ou `— Xh atrás`?** O card espelha o que o sensor reportou pela última vez. Se o tempo desde o último uplink
continua subindo, o device provavelmente está offline ou sem bateria — abra a visualização de Sensores daquele grupo para investigar.

**Um novo sensor não aparece na aba Câmaras Frias. Por quê?** O card só aparece depois que o sensor produz o primeiro uplink (o `uplink-handler` escreve o registro
`cold_room_card_data` no device da organização na primeira vez que vê um valor daquele sensor). Assim que o device envia dados, o card aparece automaticamente.

## 💎 Dicas

- Use nomes que reflitam o mundo real (por exemplo, _Câmara Fria A_, _2º Andar — Ala Norte_). O nome do grupo aparece em toda a aplicação e em notificações.
- O endereço é apenas informativo neste nível — o dashboard de Sensores não o mostra em um mapa. Ainda assim, fornecer um endereço preciso torna os dados mais fáceis de interpretar
  depois.
- Uma organização pode ter qualquer número de grupos. Comece com a estrutura que espelha seus sites físicos e refine conforme entende o que os usuários precisam.
- Use o campo de busca na aba Câmaras Frias para ir direto a um sensor pelo nome quando a organização tiver muitos sensores — bem mais rápido que rolar a tela.
