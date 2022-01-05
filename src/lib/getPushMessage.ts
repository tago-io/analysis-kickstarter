import { Account } from "@tago-io/sdk";

interface NotificationMessage {
  [key: string]: any;
  device?: string;
  percent?: string;
  location?: string;
}

export default async function getPushMessage(account: Account, message_builder: NotificationMessage, template_name: string) {
  const run = await account.run.info();
  const template = run.email_templates[template_name];

  template.value = template.value.replace(/\$/g, "");
  for (const key of Object.keys(message_builder)) {
    const regex = new RegExp(`${key}`, "g");
    template.value = template.value.replace(regex, message_builder[key]);
  }

  return template;
}
