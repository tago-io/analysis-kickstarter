import { Account, Utils } from "@tago-io/sdk";
import { ActionInfo } from "@tago-io/sdk/out/modules/Account/actions.types";
import { RouterConstructorData } from "../../types";

/**
 * Function to be used externally when need to remove a device from an alert.
 */
async function removeDeviceFromAlert(account: Account, action_id: string, device_id: string) {
  const action_info: Omit<ActionInfo, "trigger"> & { trigger: any } = (await account.actions.info(action_id)) as any;

  delete action_info.created_at;
  delete action_info.updated_at;
  delete action_info.last_triggered;
  delete action_info.description;
  delete action_info.id;

  action_info.tags = action_info.tags.filter((tag) => tag.value !== device_id);
  action_info.trigger = action_info.trigger.filter((trigger: any) => trigger.device !== device_id);

  // Add a random trigger, so the API can accept it.
  if (!action_info.trigger.length) {
    action_info.trigger.push({
      is: "<",
      unlock: true,
      value: "0",
      value_type: "number",
      variable: "not_used_and_doesnt_exist",
      tag_key: "tag_not_used_and_doesnt_exist",
      tag_value: "temp_value",
      second_value: "",
    });
  }

  account.actions.edit(action_id, action_info);
}

/**
 * Main delete alert function.
 */
async function deleteAlert({ account, environment, scope, config_dev, context }: RouterConstructorData) {
  const { serie } = scope[0];
  if (!serie) {
    return;
  }

  const device = await Utils.getDevice(account, scope[0].origin);
  device.deleteData({ series: serie });

  const action_info = await account.actions.info(serie);
  if (!action_info) {
    return;
  }

  await account.actions.delete(serie);
  const devices = [...new Set(action_info.trigger.map((x: any) => x.device).filter((x) => x))];
  for (const device_id of devices) {
    const params = await account.devices.paramList(device_id);

    const paramToDelete = params.find((x) => x.key.includes(serie));
    if (paramToDelete) {
      await account.devices.paramRemove(device_id, paramToDelete.id);
    }
  }
}

export { deleteAlert, removeDeviceFromAlert };
