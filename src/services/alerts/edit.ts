import { Resources } from "@tago-io/sdk";
import { ActionQuery, Data } from "@tago-io/sdk/lib/types";

import { sendNotificationFeedback } from "../../lib/send-notification";
import { RouterConstructorData } from "../../types";
import { checkInAlertSet } from "./check-in-alerts";
import { ActionStructureParams, generateActionStructure, getGroupDevices } from "./register";

interface ActionListParams {
  device_id?: string;
  action_id?: string;
  group_id?: string;
  organization_id?: string;
}

/**
 * Function to be used externally when need to add a device to an alert.
 * @param org_id Id of the organization
 * @param action_id Id of the action
 * @param device_id Id of the device that will be sent the alert
 */
async function addDeviceToAlert(org_id: string, action_id: string, device_id: string) {
  const [action_variable] = await Resources.devices.getDeviceData(org_id, { variables: ["action_list_variable", "action_group_variable"], qty: 1, groups: action_id });
  if (!action_variable) {
    console.debug(`Couldnt find the action_variable for ${action_id}`);
    return;
  }
  const action_info = await Resources.actions.info(action_id);
  if (!action_info.tags) {
    throw "Action not found";
  }
  const device_list = [...new Set(action_info.tags.filter((tag) => tag.key === "device_id").map((tag) => tag.value))];
  device_list.push(device_id);

  const action_strcuture = generateActionStructure(action_variable.metadata as any, device_list);
  await Resources.actions.edit(action_id, action_strcuture);
}

/**
 * List all actions based on a "and" filter
 * @param device_id
 * @param qty Number of devices that will be listed
 */
async function listDeviceAction({ device_id, action_id, group_id, organization_id }: ActionListParams, qty: number = 9999) {
  if (!device_id && !action_id && !group_id) {
    throw "Invalid filter";
  }

  const filter: ActionQuery["filter"] = {
    tags: [],
  };
  if (!filter.tags) {
    filter.tags = [];
  }
  if (device_id) {
    filter.tags.push({ key: "device_id", value: device_id });
  }
  if (group_id) {
    filter.tags.push({ key: "group_id", value: group_id });
  }
  if (organization_id) {
    filter.tags.push({ key: "organization_id", value: organization_id });
  }

  return Resources.actions.list({ amount: qty, fields: ["id", "tags"], filter });
}

async function undoChanges(organization_id: string, scope: Data[]) {
  await Resources.devices.deleteDeviceData(organization_id, { variables: scope.map((data) => data.variable), groups: scope[0].device });
  await Resources.devices.sendDeviceData(
    organization_id,
    scope.map((data) => ({ ...data, value: data?.metadata?.old_value }))
  );
}
/**
 * Main edit alert function
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 * @param scope Number of devices that will be listed
 */
async function editAlert({ environment, scope }: RouterConstructorData) {
  if (!scope) {
    throw "Organization device not found";
  }

  const organization_id = scope[0].device;
  if (!organization_id) {
    throw "Organization device not found";
  }

  const { group: action_id } = scope[0];
  if (!action_id) {
    throw "Action not found";
  }

  // Get the fields from the Dynamic Table widget.
  // If the field was not edited, the value of the variable will be equal to null.
  const action_devices = scope.find((x) => ["action_list_devices"].includes(x.variable));
  const action_group = scope.find((x) => ["action_group_group"].includes(x.variable));

  let action_variable = scope.find((x) => ["action_list_variable", "action_group_variable"].includes(x.variable));
  const action_condition = scope.find((x) => ["action_list_condition", "action_group_condition"].includes(x.variable));
  const action_value = scope.find((x) => ["action_list_value", "action_group_value"].includes(x.variable));

  const action_type = scope.find((x) => ["action_list_type", "action_group_type"].includes(x.variable));
  const action_sendto = scope.find((x) => ["action_list_sendto", "action_group_sendto"].includes(x.variable));

  if (!action_variable) {
    [action_variable] = await Resources.devices.getDeviceData(organization_id, { variables: ["action_list_variable", "action_group_variable"], qty: 1, groups: action_id });
  }

  if (!action_variable) {
    console.debug("[Error] Update action: action_variable not found");
    void undoChanges(organization_id, scope);
    return sendNotificationFeedback({ environment, title: "An error ocurred, please try again", message: "Error when editing alert" });
  }

  let device_list: string[] = [];
  if (action_devices) {
    device_list = (action_devices.value as string).split(";");
  } else if (action_group) {
    device_list = await getGroupDevices(action_group.value as string);
  } else {
    const action_info = await Resources.actions.info(action_id);
    if (!action_info.tags) {
      throw "Action tags not found";
    }
    const group_id = action_info.tags.find((tag) => tag.key === "group_id")?.value;
    if (group_id) {
      device_list = await getGroupDevices(group_id);
    } else {
      device_list = action_info.tags.filter((tag) => tag.key === "device_id").map((tag) => tag.value);
    }
  }

  const structure: ActionStructureParams = action_variable.metadata as any;
  structure.variable = action_variable.value as string;

  if (action_condition) {
    structure.condition = action_condition.value as string;
  }
  if (action_condition) {
    structure.condition = action_condition.value as string;
  }
  if (action_value) {
    const [value, value_2] = (action_value.value as string).split(";");
    if (value_2) {
      structure.trigger_value2 = value_2;
    }
    structure.trigger_value = value;
  }

  if (action_type) {
    structure.type = action_type.value as string;
  }
  if (action_sendto) {
    structure.send_to = action_sendto.value as string;
  }
  if (action_value && structure.condition === "><" && (action_value.value as string)?.split(";").length !== 2) {
    void undoChanges(organization_id, scope);
    void sendNotificationFeedback({ environment, message: "Invalid between condition, you must enter the value such as: 2;15" });
    throw `[Error] Invalid between value: ${action_value.value}`;
  }

  const action_structure = generateActionStructure(structure, device_list);

  if (structure.variable === "checkin") {
    await checkInAlertSet(action_id, structure.trigger_value as number, device_list);
  }

  await Resources.actions.edit(action_id, action_structure).catch(async (error) => {
    console.debug("[Error] ", error);
    // Simple way to remove the edited fields and add it back again with the old value;
    void undoChanges(organization_id, scope);
    await sendNotificationFeedback({ environment, message: error });
    return error;
  });

  await Resources.devices.deleteDeviceData(organization_id, { variables: ["action_list_variable", "action_group_variable"], groups: action_id });
  await Resources.devices.sendDeviceData(organization_id, { ...action_variable, metadata: structure });
}

export { editAlert, listDeviceAction, addDeviceToAlert };
