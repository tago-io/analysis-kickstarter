import { Utils } from "@tago-io/sdk";
import { fetchDeviceList } from "../../lib/fetchDeviceList";
import { RouterConstructorDevice } from "../../types";

async function groupDel({ config_dev, context, scope, account, environment }: RouterConstructorDevice) {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  const group_id = (scope[0] as any).device;
  if (!group_id) {
    return;
  }

  const group_info = await account.devices.info(group_id);
  if (!group_info?.tags) {
    throw new Error("Group not found");
  }
  const org_id = group_info.tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization id not found");
  }
  const org_dev = await Utils.getDevice(account, org_id);

  //delete from settings_device
  await config_dev.deleteData({ groups: group_id, qty: 9999 });
  //delete from org_dev
  await org_dev.deleteData({ groups: group_id, qty: 9999 });

  //deleting users (site's user)
  const user_accounts = await account.run.listUsers({ filter: { tags: [{ key: "group_id", value: group_id }] } });
  if (user_accounts) {
    user_accounts.forEach(async (user) => {
      if (!user.id) {
        throw new Error("User not found");
      }
      await account.run.userDelete(user.id);
      await org_dev.deleteData({ groups: user.id, qty: 9999 }).then((msg) => console.debug(msg));
      await config_dev.deleteData({ groups: user.id, qty: 9999 });
    });
  }

  //to comment ~ should not delete the sensors but remove the sensor's group name
  //deleting site's device

  const devices = await fetchDeviceList(account, [{ key: "group_id", value: group_id }]);

  if (devices) {
    devices.forEach(async (x) => {
      account.devices.delete(x.id); /*passing the device id*/
      await org_dev.deleteData({ groups: x.id, qty: 9999 }).then((msg) => msg); //deleting org_dev and config_dev data
      await config_dev.deleteData({ groups: x.id, qty: 9999 });
    });
  }
}

export { groupDel };
