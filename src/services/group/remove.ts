import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { fetchDeviceList } from "../../lib/fetch-device-list";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { RouterConstructorDevice } from "../../types";

/**
 * Main function of deleting groups
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function groupDel({ scope, environment }: RouterConstructorDevice & { scope: DeviceListScope[] }) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const group_id = scope[0].device;
  if (!group_id) {
    return;
  }

  const group_info = await Resources.devices.info(group_id);
  if (!group_info?.tags) {
    throw new Error("Group not found");
  }
  const org_id = group_info.tags.find((x) => x.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization id not found");
  }

  const [is_used_by_sensor] = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "device" },
      { key: "sensor", value: "soil" },
      { key: "group_id", value: group_id },
    ],
  });

  if (is_used_by_sensor) {
    await sendNotificationFeedback({ environment, message: `Group is being used by a sensor - ${is_used_by_sensor.name}` });
    throw new Error("Group is being used by a sensor");
  }

  //delete from settings_device
  await Resources.devices.deleteDeviceData(config_id, { groups: group_id, qty: 9999 });
  //delete from org_dev
  await Resources.devices.deleteDeviceData(org_id, { groups: group_id, qty: 9999 });

  //deleting users (site's user)
  const user_accounts = await Resources.run.listUsers({ filter: { tags: [{ key: "group_id", value: group_id }] } });
  if (user_accounts) {
    for (const user of user_accounts) {
      if (!user.id) {
        throw new Error("User not found");
      }
      await Resources.run.userDelete(user.id);
      await Resources.devices.deleteDeviceData(org_id, { groups: user.id, qty: 9999 }).then((msg) => console.debug(msg));
      await Resources.devices.deleteDeviceData(config_id, { groups: user.id, qty: 9999 });
    }
  }

  //to comment ~ should not delete the sensors but remove the sensor's group name
  //deleting site's device

  const devices = await fetchDeviceList({ tags: [{ key: "group_id", value: group_id }] });

  if (devices) {
    for (const device of devices) {
      await Resources.devices.delete(device.id); /*passing the device id*/
      await Resources.devices.deleteDeviceData(org_id, { groups: device.id, qty: 9999 }).then((msg) => msg);
      await Resources.devices.deleteDeviceData(config_id, { groups: device.id, qty: 9999 });
    }
  }

  return console.debug("Group deleted!");
}

export { groupDel };
