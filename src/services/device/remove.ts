import { Utils } from "@tago-io/sdk";
import { RouterConstructorDevice } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorDevice) => {
  const dev_id = (scope[0] as any).device;
  const device_info = await (await Utils.getDevice(account, dev_id)).info();

  const group_id = device_info.tags.find((tag) => tag.key === "group_id")?.value;
  const org_id = device_info.tags.find((tag) => tag.key === "organization_id").value;

  if (org_id) {
    const org_dev = await Utils.getDevice(account, org_id);
    await org_dev.deleteData({ groups: dev_id, qty: 9999 });
  }

  if (group_id) {
    const group_dev = await Utils.getDevice(account, group_id as string);
    await group_dev.deleteData({ groups: dev_id, qty: 9999 });
  }

  await config_dev.deleteData({ groups: dev_id, qty: 99999 });

  await account.devices.delete(dev_id);
  return console.log("Device deleted!");
};
