import { Resources } from "@tago-io/sdk";

interface NotificationMessage {
  [key: string]: any;
  device?: string;
  percent?: string;
  location?: string;
}

async function getPushMessage(message_builder: NotificationMessage, template_name: string) {
  const run = await Resources.run.info();
  const template = run.email_templates[template_name];

  template.value = template.value.replaceAll("$", "");
  for (const key of Object.keys(message_builder)) {
    const regex = new RegExp(`${key}`, "g");
    template.value = template.value.replace(regex, message_builder[key]);
  }

  return template;
}
export { getPushMessage };
