import { Device, Resources } from "@tago-io/sdk";
import { DeviceCreateInfo } from "@tago-io/sdk/lib/types";
import { parseTagoObject } from "../../lib/data.logic";
import { fetchDeviceList } from "../../lib/fetch-device-list";
import { getDashboardByConnectorID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { DeviceCreated, EntityData, RouterConstructorEntity } from "../../types";
import { deviceModel } from "./device.model";
import { getZodError } from "../../lib/get-zod-error";
import { createURL } from "../../lib/url-creator";
interface installDeviceParam {
  new_dev_name: string;
  org_id: string;
  network_id: string;
  connector: string;
  new_device_eui: string;
  type: string;
  group_id?: string;
}

/**
 * Function that create devices
 * @param new_dev_name Name of the device
 * @param org_id Organization id that devices will be created
 * @param network_id Network id that devices will be created
 * @param connector Connector id that devices will be created
 * @param new_device_eui Device eui configured by the user
 * @param type Sensor type of the device
 * @param group_id Group id that devices will be created
 */
async function installDevice({ new_dev_name, org_id, network_id, connector, new_device_eui, type, group_id }: installDeviceParam) {
  //data retention set to 1 month
  const device_data: DeviceCreateInfo = {
    name: new_dev_name,
    network: network_id,
    serie_number: new_device_eui,
    connector,
    type: "immutable",
    chunk_period: "month",
    chunk_retention: 1,
  };

  //creating new device
  const new_dev = await Resources.devices.create(device_data);

  const new_tags = {
    tags: [
      { key: "device_id", value: new_dev.device_id },
      { key: "organization_id", value: org_id },
      { key: "device_type", value: "device" },
      { key: "sensor", value: type },
      { key: "dev_eui", value: new_device_eui },
    ],
  };

  if (group_id) {
    new_tags.tags.push({ key: "group_id", value: group_id });
  }

  await Resources.devices.edit(new_dev.device_id, new_tags);

  const new_org_dev = new Device({ token: new_dev.token });

  return { ...new_dev, device: new_org_dev } as DeviceCreated;
}

async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const name = scope.find((x) => x.new_dev_name)?.new_dev_name as string;
  const eui = scope.find((x) => x.new_dev_eui)?.new_dev_eui as string;
  const group = scope.find((x) => x.new_dev_group)?.new_dev_group as string;
  const type = scope.find((x) => x.new_dev_type)?.new_dev_type as string;
  const network = scope.find((x) => x.new_dev_network)?.new_dev_network as string;

  const result = await deviceModel.parseAsync({
    name: name,
    eui: eui,
    group: group,
    type: type,
    network: network,
  });

  return result;
}

/**
 * Main function of creating devices
 * @param context Context is a variable sent by the analysis
 * @param scope Number of devices that will be listed
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function sensorAdd({ context, scope, environment }: RouterConstructorEntity) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const org_id = scope[0].entity;

  const validate = initializeValidation("dev_validation", config_id);
  await validate("#VAL.REGISTERING#", "warning").catch((error) => console.error(error));

  const sensor_qty = await fetchDeviceList({
    tags: [
      { key: "device_type", value: "device" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (sensor_qty.length >= 5) {
    const error = "Limit of 5 devices reached";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

  const formFields = await getFormFields(scope)
    .catch(getZodError)
    .catch(async (error) => {
      await validate(error, "danger");
      throw error;
    });

  if (!formFields) {
    const error = "Form fields are required.";
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }
  //If choosing for the simulator, we generate a random EUI
  const dev_eui = (formFields.eui as string)?.toUpperCase() || String(Math.ceil(Math.random() * 10_000_000));

  const dev_exists = await fetchDeviceList({ tags: [{ key: "dev_eui", value: dev_eui }] });

  if (dev_exists.length > 0) {
    const error = "Sensor EUI already in use.";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

  const group_id = formFields.group as string;

  const connector_id = formFields.type as string;

  let dash_id = "";
  try {
    ({ id: dash_id } = await getDashboardByConnectorID(connector_id));
  } catch (_error) {
    const error = "No dashboard found";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

  const dash_info = await Resources.dashboards.info(dash_id);
  const type = dash_info.blueprint_devices.find((bp) => bp.conditions[0].key === "sensor");
  if (!type) {
    const error = "Dashboard is missing the blueprint device sensor";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

  const { device_id } = await installDevice({
    new_dev_name: formFields.name,
    org_id,
    network_id: formFields.network,
    connector: connector_id,
    new_device_eui: dev_eui,
    type: type.conditions[0].value,
    group_id,
  });

  const url = createURL()
    .setBase(`/dashboards/info/${dash_id}`)
    .addParam("org_dev", org_id)
    .addParam("sensor", device_id)
    .build();

  await Resources.devices.paramSet(device_id, {
    key: "dashboard_url",
    value: url,
    sent: false,
  });

  await Resources.devices.paramSet(device_id, { key: "dev_eui", value: dev_eui, sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_group", value: (group_id || "") || "", sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_lastcheckin", value: "-", sent: false });
  await Resources.devices.paramSet(device_id, { key: "dev_battery", value: "-", sent: false });

  const dataToSend = [
    {
      dev_id: {
        value: device_id,
        metadata: {
          label: formFields.name,
          url,
          status: "unknwon",
          type: dash_info.type,
        },
      },
    },
    {
      asset_list: {
        value: formFields.name,
      },
    },
  ];
  await Resources.entities.sendEntityData(org_id, dataToSend);

  //TODO: verify if this is needed
  // if (group_id) {
  //   await Resources.entities.sendEntityData(group_id, dataToSend);
  // }

  return validate("#VAL.DEVICE_CREATED_SUCCESSFULLY#", "success");
}

export { sensorAdd };
