import getDevice from "@tago-io/sdk/out/modules/Utils/getDevice";
import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const action_serie = scope[0].serie;

  const [action_registered] = await account.actions.list({
    page: 1,
    fields: ["id", "name", "tags"],
    filter: {
      tags: [{ key: "action_serie", value: action_serie }],
    },
    amount: 1,
  });

  const org_id = action_registered.tags.find((x) => x.key === "organization_id")?.value;

  const org_dev = await getDevice(account, org_id);
  await org_dev.deleteData({ series: action_serie, qty: 9999 });

  if (!action_registered) {
    return console.log("ERROR - No action found.");
  }

  await account.actions.delete(action_registered.id);

  return console.log("Action deleted successfully!");
};
