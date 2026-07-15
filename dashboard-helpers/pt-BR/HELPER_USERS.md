# 👥 Usuários

## 💡 O que é um Usuário?

Um **Usuário** é uma pessoa que faz login na sua aplicação através do TagoRUN — um cliente, um técnico, um operador ou qualquer pessoa que precise ver dados. Todo usuário pertence
a uma organização (com exceção dos Admins da Aplicação, que não estão vinculados a nenhuma) e tem um **nível de acesso** que decide o que ele pode fazer.

Este dashboard é onde você convida usuários, muda o que eles podem ver e remove acessos quando necessário.

## 🛠️ O que posso fazer neste dashboard?

Este dashboard mostra todos os usuários que pertencem à organização selecionada no topo.

- 🏢 **Seletor de organização** — O dropdown no topo restringe o dashboard a uma única organização. Ao alterá-lo, a lista é recarregada com os usuários daquela organização sem sair
  da página.
- 📋 **Lista de Usuários** — Uma tabela com nome, e-mail, telefone e nível de acesso de cada usuário. A partir daqui, você pode:
  - **Alterar senha** (o ícone de chave em _Controles_) — abre uma pequena janela para definir uma nova senha para o usuário, contornando o fluxo de e-mail.
  - **Editar** (o ícone de lápis em _Controles_) — abre um formulário para atualizar nome, telefone ou nível de acesso. O e-mail é fixo após a criação do usuário.
  - **Excluir** (o ícone de lixeira em _Controles_) — remove a conta do usuário no TagoRUN. A ação é irreversível.
- 🛡️ **Todos os Usuários (Admin)** — Uma aba só para admin que lista todos os usuários da aplicação, incluindo Admins da Aplicação não vinculados a nenhuma organização. Use quando
  precisar de uma visão global.
- ➕ **Criar Usuário** — Abre um formulário para convidar um novo usuário. Você informa nome, e-mail, um telefone opcional e o nível de acesso. O novo usuário recebe um e-mail com
  um link para definir a senha.

## 🔐 Níveis de acesso

O kickstarter vem com três níveis, definidos no modelo de usuário. Escolha o que combina com o papel do usuário:

- **Admin da Aplicação** — acesso total a todas as organizações da aplicação. Use para o time que mantém a própria plataforma.
- **Admin da Organização** — acesso total a uma única organização. Pode criar, editar e excluir grupos, sensores e outros usuários _dentro daquela organização_.
- **Convidado (Guest)** — acesso somente leitura a uma única organização. Pode visualizar dashboards mas não pode criar, editar ou excluir nada.

O nível de acesso é armazenado como uma tag (`access`) no usuário do run. Admin da Organização e Convidado também recebem uma tag `organization_id` que restringe a visibilidade
através das Access Policies.

## ⚙️ Como funciona por trás dos panos

Quando você cria um usuário, a função de analysis `createUser` executa e:

1. ✅ Valida nome, e-mail, telefone e nível de acesso usando um schema Zod. O telefone deve incluir o código do país (por exemplo, `+55` para números brasileiros); o e-mail deve
   ser um endereço válido.
2. 🔍 Verifica se o e-mail ainda não está em uso em nenhum lugar da aplicação.
3. 🏷️ Cria o usuário do run, aplica a tag `access` e (para Admin da Organização e Convidado) as tags `organization_id` e `user_organization_id` que o vinculam à organização atual.
4. 📧 Envia um e-mail de convite com a senha temporária. **A implementação de referência usa SendGrid**, mas a chamada vive em um único helper (`sendInviteEmail`) — troque por
   qualquer provider (Mailgun, SES, Resend, SMTP, etc.) sem mexer no resto do fluxo.

Ao editar um usuário, apenas os campos que você alterou são enviados. Se a validação falhar, a analysis executa `undoUserChanges` para restaurar os valores anteriores, evitando que
a UI fique fora de sincronia com o backend.

## 📧 Provider de e-mail (SendGrid)

O kickstarter espera duas variáveis de ambiente na analysis:

- `SENDGRID_API_KEY` — chave de API com escopo _Mail Send_.
- `sendgrid_from_email` — endereço de remetente verificado.

**Erros que você pode ver:**

- Variáveis ausentes → `[Error] Missing secrets 'SENDGRID_API_KEY' or 'sendgrid_from_email'.`
- O SendGrid rejeita o envio (chave errada, remetente não verificado, template ausente) → o log mostra `Email sending failed: ...` — verifique os logs da analysis para ver a
  resposta do SendGrid.

## ❓ Perguntas frequentes

**Por que não há número de telefone para alguns usuários?** O telefone é opcional no formulário. Se você não preencher, o usuário é criado sem telefone — você pode adicionar depois
pelo diálogo de edição.

**O e-mail de convite nunca chega. E agora?** Verifique a configuração do SendGrid nas variáveis de ambiente da aplicação (`SENDGRID_API_KEY` e `sendgrid_from_email`). Sem elas, a
etapa de convite falha. Como contorno, você também pode usar _Alterar senha_ para definir uma senha diretamente e compartilhá-la com o usuário por outro canal.

**Posso alterar o e-mail de um usuário?** Não. O e-mail é o identificador principal no TagoRUN e é fixo após a criação. Se um usuário mudar de e-mail, o caminho mais limpo é
excluir a conta antiga e convidá-lo novamente.

**Posso mover um usuário para outra organização?** Não existe um fluxo pronto para isso. A tag `organization_id` do usuário precisaria ser editada diretamente. Excluir e convidar
de novo é o caminho mais seguro hoje.

## 💎 Dicas

- Use _Admin da Organização_ com parcimônia. Ele dá controle total dentro da organização, incluindo o poder de excluir todos os grupos e sensores.
- _Convidado_ é o nível certo para stakeholders que só precisam olhar os dashboards — não conseguem quebrar nada.
- _Admin da Aplicação_ não tem escopo de organização. Atribua apenas ao time que mantém a plataforma; todos os demais devem ter uma tag de organização.
- Mantenha os nomes legíveis. O nome do usuário aparece em logs de auditoria e notificações, então "Maria — Técnica de Campo" é mais claro que apenas "Maria".
