# 🏢 Organizações

## 💡 O que é uma Organização?

Uma **Organização** é a entidade de mais alto nível desta aplicação. Ela representa um cliente, um site, uma equipe ou qualquer tenant que tenha um conjunto de grupos, sensores,
dashboards e usuários. Tudo na aplicação — dispositivos, dados, alertas, acessos — é restrito a uma Organização, e é isso que torna este template multi-tenant por padrão.

Se você está construindo uma aplicação IoT em que cada cliente deve ver apenas os próprios dados, a Organização é a unidade que você cria para cada cliente.

## 🛠️ O que posso fazer neste dashboard?

Este dashboard é o ponto de partida para gerenciar todas as organizações da aplicação.

- 📋 **Lista de Organizações** — Uma tabela com o nome e o endereço de cada organização. A partir daqui, você pode:
  - **Visualizar** uma organização (o ícone à esquerda) — abre o dashboard de Grupos já filtrado para aquela organização.
  - **Editar** o nome ou o endereço (o ícone de lápis em _Controles_).
  - **Excluir** a organização (o ícone de lixeira em _Controles_). Excluir uma organização também remove o dispositivo dummy e qualquer dado vinculado a ela.
- 🗺️ **Visualização em Mapa** — Mostra cada organização como um pino no mapa, com base no endereço. Clique em um pino para abrir um popup com o nome da organização, o timestamp da
  última atualização e um link _Ir para organização_ que abre o dashboard de Grupos. Use esta visualização quando quiser uma visão geográfica de todos os seus tenants.
- ➕ **Criar Organização** — Abre um formulário para adicionar uma nova organização. Você informa um nome e um endereço; o endereço é geocodificado para que a nova organização
  apareça na Visualização em Mapa.

## ⚙️ Como funciona por trás dos panos

Cada organização é armazenada como um **device** TagoIO do tipo `mutable` com a tag `device_type = organization`. Esse device atua como um pequeno armazenamento dos metadados da
organização (nome, endereço, localização) e como âncora para tudo o que pertence a ela.

Quando você cria uma organização, a função de analysis `createOrganization` executa e:

1. ✅ Valida os campos do formulário usando um schema Zod.
2. 🔍 Verifica se o nome é único dentro desta aplicação.
3. 🏷️ Cria o device, aplica as tags `organization_id` e `device_type` e armazena o endereço como parâmetro do device.

Grupos, sensores e usuários do run criados depois carregam a tag `organization_id` correspondente, e é isso que permite que as Access Policies isolem dados entre tenants.

## ❓ Perguntas frequentes

**De onde vêm os dados?** Do device de configurações da aplicação (o device dummy passado na URL como `settings_dev`). A lista e o mapa leem a mesma variável `organization` que a
analysis escreve quando você cria ou edita uma organização.

**Por que não encontro um grupo ou um sensor neste dashboard?** Este dashboard mostra apenas organizações. Para ver o que pertence a uma organização, clique em _Visualizar_ na
linha dela — você cairá no dashboard de Grupos restrito àquela organização.

**O que acontece se eu excluir uma organização que já tem grupos e sensores?** A ação de excluir remove o device da organização e dispara a limpeza, mas é recomendável remover
grupos e sensores antes para evitar devices órfãos. Verifique o dashboard de _Grupos_ dentro da organização antes de excluí-la.

## 💎 Dicas

- Mantenha os nomes das organizações claros e únicos. Eles aparecem em todos os dashboards e são usados em notificações.
- Use um endereço real ao criar uma organização — ele alimenta a Visualização em Mapa e ajuda os usuários a localizar sites rapidamente.
- Este dashboard é destinado a administradores da aplicação (nível de acesso `admin`). Admins de organização e convidados normalmente caem diretamente no dashboard de Grupos da
  própria organização.
