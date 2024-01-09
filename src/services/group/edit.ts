import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { deviceNameExists } from "../../lib/device-name-exists";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { undoDeviceChanges } from "../../lib/undo-device-changes";
import { RouterConstructorDevice } from "../../types";

/**
 * Main function of editing groups
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function groupEdit({ scope, environment }: RouterConstructorDevice & { scope: DeviceListScope[] }) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }
  const group_id = scope[0].device;
  const new_group_name = scope[0].name;

  if (new_group_name) {
    const group_info = await Resources.devices.info(group_id);
    const org_id = group_info.tags.find((x) => x.key === "organization_id")?.value as string;
    const is_device_name_exists = await deviceNameExists({
      name: new_group_name,
      tags: [
        { key: "device_type", value: "group" },
        { key: "organization_id", value: org_id },
      ],
      isEdit: true,
    });

    if (is_device_name_exists) {
      await undoDeviceChanges({ deviceInfo: group_info, scope });
      await sendNotificationFeedback({ environment, message: `The organization with name ${new_group_name} already exists.` });
      throw `The organization with name ${new_group_name} already exists.`;
    }
  }

  const { tags } = await Resources.devices.info(group_id);
  if (!tags) {
    throw new Error("Tags not found");
  }
  const org_id = tags.find((tag) => tag.key === "organization_id")?.value;
  if (!org_id) {
    throw new Error("Organization id not found");
  }

  const [group_id_data] = await Resources.devices.getDeviceData(org_id, { variables: "group_id", groups: group_id, qty: 1 });
  if (group_id_data) {
    await Resources.devices.deleteDeviceData(org_id, { variables: "group_id", groups: group_id });
    await Resources.devices.sendDeviceData(org_id, { ...group_id_data, metadata: { ...group_id_data.metadata, label: new_group_name } });
  }

  return console.debug("Group edited!");
}

export { groupEdit };
