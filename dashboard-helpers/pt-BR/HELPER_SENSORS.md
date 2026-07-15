# 📡 Sensores

## 💡 O que é um Sensor?

Um **Sensor** é um dispositivo IoT que envia dados para o TagoIO — uma sonda de temperatura, um rastreador GPS, um medidor de energia ou qualquer hardware que produza medições.
Nesta aplicação, cada sensor pertence a um grupo, que por sua vez pertence a uma organização, então os dados estão sempre restritos ao tenant e à área corretos.

Cada sensor é identificado por um **EUI** único, o código de hardware impresso no dispositivo. O EUI é o que o TagoIO usa para rotear pacotes recebidos para o sensor correto.

## 🛠️ O que posso fazer neste dashboard?

Este dashboard mostra todos os sensores dentro do grupo que você abriu a partir do dashboard de Grupos.

- 📊 **Cards de Status dos Sensores** — Um resumo no topo com três contagens: total _Registrados_, _Ativos_ (enviando dados no momento) e _Inativos_ (sem enviar dados). O total é
  atualizado automaticamente toda vez que você cria ou exclui um sensor.
- 📋 **Lista de Sensores** — Uma tabela com nome, EUI, rede, modelo, último contato e bateria de cada sensor do grupo. A partir daqui, você pode:
  - **Visualizar** um sensor (o ícone à esquerda) — abre o dashboard de detalhes do sensor com gráficos e dados recentes.
  - **Editar** o nome do sensor (o ícone de lápis em _Controles_).
  - **Excluir** o sensor (o ícone de lixeira em _Controles_). A exclusão é irreversível — o device e todos os dados armazenados são removidos.
- 🛡️ **Todos os Dispositivos (Admin)** — Uma aba só para admin que lista todos os devices deste grupo, incluindo devices dummy (como o device do próprio grupo). Use somente quando
  precisar inspecionar ou reparar os objetos TagoIO subjacentes.
- ➕ **Criar Sensor** — Abre um formulário para adicionar um novo sensor. Você informa um nome, escolhe a rede e o modelo e insere o EUI. O sensor é criado dentro do grupo atual.

## ⚙️ Como funciona por trás dos panos

Cada sensor é armazenado como um **device** TagoIO do tipo `immutable` (armazenamento em série temporal) com as tags `device_type = device`, `sensor_id`, `device_eui`, `group_id` e
`organization_id`. A rede e o connector escolhidos no formulário definem como os payloads recebidos são decodificados.

Quando você cria um sensor, a função de analysis `createSensor` executa e:

1. ✅ Valida os campos do formulário usando um schema Zod (tamanho do nome, formato do EUI, rede, connector).
2. 🔍 Verifica se o nome é único dentro do grupo pai e se o EUI é único em toda a aplicação (dois sensores não podem compartilhar o mesmo código de hardware).
3. 🏷️ Cria o device, aplica as tags acima e armazena o EUI e um deep-link para o dashboard do sensor como parâmetros do device.
4. 🔄 Atualiza o registro `device_connectivity_summary` do grupo para que os cards de Status dos Sensores reflitam o novo total.

O fluxo de exclusão é o inverso: remove o device e em seguida atualiza o mesmo registro de resumo no grupo, então o contador cai imediatamente.

## ❓ Perguntas frequentes

**O que é o EUI e onde encontro?** O EUI é um identificador hexadecimal de 16 caracteres (`0123456789ABCDEF`). Ele vem impresso no próprio dispositivo ou na caixa, e o fabricante
garante que é único. Você também pode escaneá-lo com o botão _Escanear QR Code_ se o dispositivo tiver um QR code.

**Por que o widget de Status dos Sensores mostra `—` nas contagens de ativos e inativos?** A contagem total de registrados é mantida pelas analyses de criação e exclusão, mas as
contagens de ativos e inativos vêm de um fluxo de monitoramento separado que acompanha o último uplink de cada sensor. Em uma instalação nova, esses valores ficam como `—` até que
uma action de monitoramento comece a atualizá-los.

**Dois sensores podem ter o mesmo EUI?** Não. A aplicação garante unicidade no momento da criação, porque o EUI é o que liga os dados recebidos ao sensor correto. Se dois sensores
compartilhassem o EUI, os dados deles colidiriam.

**O que acontece se eu excluir um sensor?** O device, todos os dados em série temporal, parâmetros e tags são removidos. A ação é irreversível, então exporte qualquer coisa que
precise antes de excluir.

## 💎 Dicas

- Use nomes que descrevam o papel e a localização, como _Freezer 02 — Prateleira de Cima_. O nome do sensor aparece em dashboards, alertas e notificações.
- O modelo define qual decoder é aplicado aos dados recebidos. Escolher o modelo certo é o que faz com que os dados do sensor apareçam nas unidades corretas.
- Se um sensor para de aparecer em _Ativos_, verifique primeiro a coluna _Último contato_ — intervalos longos normalmente indicam que o dispositivo está offline ou sem bateria.
