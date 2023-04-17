import { Utils } from "@tago-io/sdk";
import { RouterConstructorDevice } from "../../types";

async function groupEdit({ config_dev, context, scope, account, environment }: RouterConstructorDevice) {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const group_id = (scope[0] as any).device;
  const new_group_name = (scope[0] as any).name;

  if (!new_group_name) {
    return "No group name";
  }

  const { tags } = await account.devices.info(group_id);
  if (!tags) {
    throw new Error("Tags not found");
  }
  const org_id = tags.find((tag) => tag.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization id not found");
  }

  const org_dev = await Utils.getDevice(account, org_id);

  const [group_id_data] = await org_dev.getData({ variables: "group_id", groups: group_id, qty: 1 });
  if (group_id_data) {
    await org_dev.deleteData({ variables: "group_id", groups: group_id });
    await org_dev.sendData({ ...group_id_data, metadata: { ...group_id_data.metadata, label: new_group_name } });
  }

  return console.debug("Group edited!");
}

export { groupEdit };
