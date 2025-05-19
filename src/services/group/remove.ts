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

  const groupDataId = scope[0].id;
  if (!groupDataId) {
    return;
  }

  const groupId = scope.find((x) => x.field === "group_id")?.value;
  if (!groupId) {
    return;
  }

  const group_info = await Resources.entities.info(groupId);
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
      { key: "group_id", value: groupId },
    ],
  });

  if (is_used_by_sensor) {
    await sendNotificationFeedback({ environment, message: `Group is being used by a sensor - ${is_used_by_sensor.name}` });
    throw new Error("Group is being used by a sensor");
  }

  const [organizationGroup] = await Resources.entities.list({
    filter: {
      tags: [
        { key: "organization_id", value: org_id },
        { key: "entity_type", value: "organization_group" },
      ],
    },
    amount: 1,
  });

  if (!organizationGroup) {
    throw new Error("Organization group not found");
  }

  //delete from organization group
  await Resources.entities.deleteEntityData(organizationGroup.id, { ids: [groupDataId] });
  //delete from org_dev
  await Resources.entities.delete(groupId);

  return console.debug("Group deleted!");
}

export { groupDel };
