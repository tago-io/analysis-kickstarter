import { Utils } from "@tago-io/sdk";
import { RouterConstructorDevice } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorDevice) => {
  const group_id = (scope[0] as any).device;
  if (!group_id) {
    return;
  }

  const group_info = await account.devices.info(group_id);
  const org_id = group_info.tags.find((x) => x.key === "organization_id").value;
  const org_dev = await Utils.getDevice(account, org_id);

  //delete from settings_device
  await config_dev.deleteData({ series: group_id, qty: 9999 });
  //delete from org_dev
  await org_dev.deleteData({ series: group_id, qty: 9999 });

  //deleting users (site's user)
  const user_accounts = await account.run.listUsers({ filter: { tags: [{ key: "group_id", value: group_id }] } });
  if (user_accounts) {
    user_accounts.forEach(async (user) => {
      await account.run.userDelete(user.id);
      await org_dev.deleteData({ series: user.id, qty: 9999 }).then((msg) => console.log(msg));
      await config_dev.deleteData({ series: user.id, qty: 9999 });
    });
  }

  //deleting site's device
  const devices = await account.devices.list({
    amount: 9999,
    page: 1,
    filter: { tags: [{ key: "group_id", value: group_id }] },
    fields: ["id", "bucket", "tags", "name"],
  });

  if (devices) {
    devices.forEach(async (x) => {
      account.devices.delete(x.id); /*passing the device id*/
      account.buckets.delete(x.bucket); /*passing the bucket id*/
      await org_dev.deleteData({ series: x.id, qty: 9999 }).then((msg) => msg); //deleting org_dev and config_dev data
      await config_dev.deleteData({ series: x.id, qty: 9999 });
    });
  }
};
