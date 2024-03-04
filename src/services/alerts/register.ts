import { Resources } from "@tago-io/sdk";
import { Data, DataToSend, DeviceListItem } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../../lib/data.logic";
import { fetchDeviceList } from "../../lib/fetch-device-list";
import { getDashboardByTagID } from "../../lib/find-resource";
import { RouterConstructorData } from "../../types";
import { checkInAlertSet } from "./check-in-alerts";
import { geofenceAlertCreate } from "./geofence-alert";

/**
 * The function returns the group that was configured in the alert
 * @param group_id Id of the group
 * @param groupKey Tag key that will be used in the device list
 */
async function getGroupDevices(group_id: string, groupKey: string = "group_id") {
  const list: DeviceListItem[] = await fetchDeviceList({
    tags: [
      { key: groupKey, value: group_id },
      { key: "device_type", value: "device" }, //?
    ],
  });

  return list.map((x) => x.id);
}
/**
 * Function that reverses the logic of the alert so that we can use it in the trigger unlock of the action
 * @param condition Condition of the action
 */
function reverseCondition(condition: string) {
  switch (condition) {
    case "=":
      return "!";
    case "!":
      return "=";
    case ">":
      return "<";
    case "<":
      return ">";
    default:
      break;
  }
}

interface ActionStructureParams {
  group_id?: string;
  org_id: string;

  send_to: string;
  type: string;

  trigger_value: string | number;
  trigger_value2?: string | number;
  variable: string;
  condition: string;

  script: string;
  device: string;
  name?: string;
}
/**
 * Function that generate the structure of the action create
 * @param structure Parameters used to create the structure
 * @param device_ids Device id list
 */
function generateActionStructure(structure: ActionStructureParams, device_ids: string[]) {
  const action_structure: any = {
    active: true,
    name: `Application alert trigger ${structure.group_id ? "GROUP" : "DEVICE"}`,
    tags: [
      { key: "group_id", value: structure.group_id || "N/A" },
      { key: "organization_id", value: structure.org_id },
      { key: "device", value: structure.device },
      { key: "name", value: structure.name || "" },
      { key: "send_to", value: structure.send_to.replaceAll(" ", "") },
      { key: "action_type", value: structure.type.replaceAll(" ", "") },
    ],
    type: "condition",
    trigger: [],
    action: {
      type: "script",
      script: [structure.script],
    },
  };

  const variables = structure.variable.split(",");
  for (const device_id of device_ids) {
    for (const variable of variables) {
      action_structure.trigger.push({
        is: structure.condition,
        value: String(structure.trigger_value),
        value_type: "number",
        variable,
        device: device_id,
        second_value: structure.trigger_value2,
      });

      if (structure.type !== "><") {
        action_structure.trigger.push({
          is: reverseCondition(structure.condition),
          unlock: true,
          value: String(structure.trigger_value),
          value_type: "number",
          variable,
          device: device_id,
          second_value: structure.trigger_value2 || "",
        });
      } else {
        action_structure.trigger.push({
          is: "<",
          unlock: true,
          value: String(structure.trigger_value),
          value_type: "number",
          variable,
          device: device_id,
          second_value: "",
        });

        action_structure.trigger.push({
          is: ">",
          unlock: true,
          value: String(structure.trigger_value2),
          value_type: "number",
          variable,
          device: device_id,
          second_value: "",
        });
      }
    }
  }

  // Add a random trigger, so the API can accept it.
  if (action_structure.trigger.length === 0) {
    action_structure.trigger.push({
      is: "=",
      value: String(structure.trigger_value),
      value_type: "number",
      variable: "not_used_and_doesnt_exist",
      tag_key: "tag_not_used_and_doesnt_exist",
      tag_value: "temp_value",
      second_value: "",
    });
  }

  return action_structure;
}

/**
 * Main function of creating alerts
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 * @param scope Number of devices that will be listed
 */
async function createAlert({ environment, scope }: RouterConstructorData) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }
  const organization_id = scope[0].device;
  await Resources.devices.sendDeviceData(organization_id, { variable: "action_validation", value: "#VAL.CREATING_ALERT#", metadata: { type: "warning" } });

  // Get the fields from the Input widget.
  const action_group = scope.find((x) => x.variable === "action_group_list");
  const action_dev_list = scope.find((x) => x.variable === "action_device_list" && x.metadata?.sentValues);
  const action_sendto = scope.find((x) => x.variable === "action_sendto");

  const action_variable = scope.find((x) => x.variable === "action_variable");
  let action_condition: Data | DataToSend | undefined = scope.find((x) => x.variable === "action_condition");
  let action_value = scope.find((x) => x.variable === "action_value");
  const action_value2 = scope.find((x) => x.variable === "action_value2");

  const action_type = scope.find((x) => x.variable === "action_type");
  const action_message = scope.find((x) => x.variable === "action_message");

  const action_name = scope.find((x) => x.variable === "action_name")?.value as string;

  let groupKey = scope.find((x) => x.variable === "action_groupkey")?.value as string;
  if (!groupKey) {
    groupKey = "group_id";
  }

  // const action_unlock_variable = scope.find((x) => x.variable === "action_unlock_variable");
  // const action_unlock_condition = scope.find((x) => x.variable === "action_unlock_condition");
  // const action_unlock_value = scope.find((x) => x.variable === "action_unlock_value");

  const action_value_unit = scope.find((x) => x.variable === "action_value_unit");

  if (action_value_unit?.value === "F" && action_value?.value) {
    action_value.value = (((Number(action_value?.value) - 32) * 5) / 9).toFixed(2);
    if (action_value2?.value) {
      action_value2.value = (((Number(action_value2?.value) - 32) * 5) / 9).toFixed(2);
    }
  }

  if (!action_condition?.value) {
    action_value = scope.find((x) => x.variable === "action_binary_value");
    action_condition = { device: scope[0].device, time: new Date(), variable: "action_condition", value: "=" };
  }

  // Validate all the fields. This is just a double check so we don't run in unexpected behaviour.
  if (!action_variable || !action_variable.value) {
    throw 'Missing "action_variable" in the data scope.';
  } else if (!action_condition || !action_condition.value) {
    throw 'Missing "action_condition" in the data scope.';
  } else if (!action_type || !action_type.value) {
    throw 'Missing "action_type" in the data scope.';
  } else if (!action_message || !action_message.value) {
    throw 'Missing "action_message" in the data scope.';
  } else if (!action_value || !action_value.value) {
    throw 'Missing "action_value" in the data scope.';
  }

  let device_list: string[] = [];

  if (action_dev_list?.metadata?.sentValues) {
    device_list = action_dev_list?.metadata?.sentValues.map((x) => x.value as string);
  } else if (action_group) {
    const group_id = action_group.value as string;
    const group_exist = await Resources.devices.info(group_id);
    if (!group_exist) {
      throw `Group ${action_group?.metadata?.label} couldn't be found.`;
    }
    device_list = await getGroupDevices(group_id, groupKey);
  }

  const script_id = await getDashboardByTagID("alertTrigger");

  if (!action_sendto?.value) {
    throw "Missing action_sendto";
  }

  // Create the action structure.
  const structure: ActionStructureParams = {
    org_id: organization_id,
    group_id: action_group?.value as string,
    script: script_id,

    trigger_value: action_value?.value as string,
    trigger_value2: action_value2?.value as string,

    send_to: action_sendto.value as string,
    condition: action_condition.value as string,
    type: action_type?.value as string,
    variable: action_variable.value as string,
    device: scope[0].device,
    name: action_name,
  };
  const action_structure = generateActionStructure(structure, device_list);

  const { action: action_id } = await Resources.actions.create(action_structure).catch(async (error) => {
    await Resources.devices.sendDeviceData(organization_id, { variable: "action_validation", value: error, metadata: { type: "danger" } });
    throw error;
  });
  // Store the data in the device, so we can see and edit it in the Dynamic Table.
  // It's very important that the group is the action ID, so we can use it to edit/delete later.
  let data_to_tago: DataToSend[] = parseTagoObject(
    {
      action_list_variable: { value: action_variable.value, metadata: structure },
      action_list_condition: action_condition.value,
      action_list_value: !action_value2 ? action_value.value : `${action_value.value},${action_value2.value}`,
      action_list_type: { value: action_type.value, metadata: action_type.metadata },
      action_list_sendto: { value: action_sendto.value, metadata: action_sendto.metadata },
      action_list_message: action_message.value,
    },
    action_id
  );

  if (action_dev_list) {
    data_to_tago.push({ variable: "action_list_devices", value: action_dev_list.value, metadata: action_dev_list.metadata, group: action_id });
  } else if (action_group) {
    data_to_tago.push({ variable: "action_group_group", value: action_group.value, metadata: action_group.metadata, group: action_id });

    // change action_list to action_group, in order to show up on alert group list.
    data_to_tago = data_to_tago.map((x) => ({ ...x, variable: x.variable.replace("action_list", "action_group") }));
  }

  await Resources.devices.sendDeviceData(organization_id, data_to_tago);
  await Resources.devices.sendDeviceData(organization_id, { variable: "action_validation", value: "#ALC.CREATE_SUCCESS#", metadata: { type: "success" } });
  if (structure.variable === "geofence") {
    await geofenceAlertCreate(organization_id, action_id, structure);
  } else if (structure.variable === "checkin") {
    await checkInAlertSet(action_id, structure.trigger_value as number, device_list);
  }
}

export { createAlert, getGroupDevices, generateActionStructure, ActionStructureParams };
