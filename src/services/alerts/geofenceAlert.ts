import { Account, Device, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { ActionInfo } from "@tago-io/sdk/out/modules/Account/actions.types";
import { ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { isPointWithinRadius } from "geolib";
import { ActionStructureParams } from "./register";
import { IAlertTrigger, sendAlert } from "./sendAlert";

// This function checks if our device is inside a polygon geofence
function insidePolygon(point: [number, number], geofence: Data["metadata"]) {
  const x = point[1];
  const y = point[0];
  let inside = false;
  for (let i = 0, j = geofence.length - 1; i < geofence.length; j = i++) {
    const xi = geofence[i][0];
    const yi = geofence[i][1];
    const xj = geofence[j][0];
    const yj = geofence[j][1];
    const intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

type ILatitude = number;
type ILongitude = number;
interface IGeofenceMetadata {
  event: string;
  geolocation: {
    type: string;
    radius: number;
    coordinates: [ILongitude, ILatitude];
  };
  id: string;
  eventColor: string;
  eventDescription: string;
}
function getGeofenceResult(check_list: boolean[], geofence_list: Data["metadata"][]): IGeofenceMetadata[] {
  return check_list
    .map((x, index) => {
      if (!x) {
        return;
      }

      return geofence_list[index];
    })
    .filter((x) => x) as any;
}

// This function checks if our device is inside any geofence
function checkZones(point: [number, number], geofence_list: Data["metadata"][]): IGeofenceMetadata[] {
  let geofences: IGeofenceMetadata[] = [];

  // The line below gets all Polygon geofences that we may have.
  const polygons = geofence_list.filter((x) => x.geolocation.type === "Polygon");
  if (polygons.length) {
    // Here we check if our device is inside any Polygon geofence using our function above.
    const pass_check = polygons.map((x) => insidePolygon(point, x.geolocation.coordinates[0]));
    geofences = geofences.concat(getGeofenceResult(pass_check, polygons));
  }

  // The line below gets all Point (circle) geofences that we may have.
  const circles = geofence_list.filter((x) => x.geolocation.type === "Point");
  if (!circles.length) {
    return geofences;
  }

  // Here we check if our device is inside any Point geofence using a third party library called geolib.
  const pass_check = circles.map((x) =>
    isPointWithinRadius(
      { latitude: point[1], longitude: point[0] },
      {
        latitude: x.geolocation.coordinates[0],
        longitude: x.geolocation.coordinates[1],
      },
      x.geolocation.radius
    )
  );

  geofences = geofences.concat(getGeofenceResult(pass_check, circles));

  return geofences;
}

type IAlertToBeSent = Omit<IAlertTrigger, "data">;
async function getAlertList(account: Account, outsideZones: IGeofenceMetadata[], deviceParams: ConfigurationParams[], device_id: string) {
  const alerts: IAlertToBeSent[] = [];
  for (const item of outsideZones) {
    const action_info: ActionInfo = await account.actions.info(item.event).catch(() => null);
    if (!action_info) {
      console.log(`Action not found ${item.event}`);
      continue;
    }

    const devices = action_info.trigger.map((x: any) => x.device).filter((x) => x);

    if (!devices.includes(device_id)) {
      continue;
    }

    const alertParam = deviceParams.find((param) => param.key === item.event);
    if (alertParam?.sent) {
      continue;
    }

    const send_to = action_info.tags
      .find((x) => x.key === "send_to")
      ?.value?.replace(/;/g, ",")
      .split(",");
    const action_type = action_info.tags
      .find((x) => x.key === "action_type")
      ?.value?.replace(/;/g, ",")
      .split(",");
    const action_origin = action_info.tags.find((x) => x.key === "origin")?.value as string;

    await account.devices.paramSet(device_id, { ...alertParam, key: item.event, value: "geofence", sent: true });
    alerts.push({ action_id: item.event, send_to, type: action_type, origin: action_origin });
  }

  return alerts;
}

interface ILocationData {
  lat: ILatitude;
  lng: ILongitude;
}
interface IGeofenceAlert {
  coordinates: ILocationData;
  device_id: string;
}

/**
 * Add this function to the analysis that is receiving the location variable somehow.
 * It can be used on statusUpdater or uplinkHandler, depending on how often you want to check the alert.
 * @param account Account instanced class
 * @param context Context of the analysis, to retrieve the token
 * @param locationData lat and lng of device current position
 */
async function geofenceAlertTrigger(account: Account, context: TagoContext, locationData: IGeofenceAlert) {
  const { coordinates, device_id } = locationData;

  const { tags } = await account.devices.info(device_id);
  const org_id = tags.find((tag) => tag.key === "organization_id")?.value as string;
  const group_id = tags.find((tag) => tag.key === "group_id")?.value as string;
  const subgroup_id = tags.find((tag) => tag.key === "subgroup_id")?.value as string;
  let geofences: Data[] = [];

  let org_dev: Device;
  if (org_id) {
    org_dev = await Utils.getDevice(account, org_id as string);
    let geofence_list = await org_dev.getData({ variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, origin: org_id } }));
    geofences = geofences.concat(geofence_list);
  }

  // Support for group owners, if the application has it.
  if (group_id) {
    const group_dev = await Utils.getDevice(account, group_id as string);
    let geofence_list = await group_dev.getData({ variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, origin: group_id } }));
    geofences = geofences.concat(geofence_list);
  }

  // Support for subgroup owners, if the application has it.
  if (subgroup_id) {
    const subgroup_dev = await Utils.getDevice(account, subgroup_id as string);
    let geofence_list = await subgroup_dev.getData({ variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, origin: subgroup_id } }));
    geofences = geofences.concat(geofence_list);
  }

  if (!org_dev) {
    return console.log("Device is not linked to an organization");
  }

  // Filter the geofences and send the alerts if any
  const geofenceMetadaList = geofences.map((geofences) => geofences.metadata) as IGeofenceMetadata[];
  const zones = checkZones([coordinates.lng, coordinates.lat], geofenceMetadaList);

  const outsideZones = geofenceMetadaList.filter((x) => x.eventColor === "green" && !zones.find((y) => y.event === x.event));
  const insideZones = geofenceMetadaList.filter((x) => x.eventColor === "red" && zones.find((y) => y.event === x.event));

  const alertsToReset = geofenceMetadaList.filter((x) => !outsideZones.find((y) => y.event === x.event) && !insideZones.find((y) => y.event === x.event));

  const deviceParams = await account.devices.paramList(device_id);
  for (const alert of alertsToReset) {
    const param = deviceParams.find((param) => param.key.includes(alert.event));
    if (!param) {
      continue;
    }

    account.devices.paramSet(device_id, { ...param, sent: false });
  }

  let alerts: IAlertToBeSent[] = [];
  if (outsideZones.length) {
    alerts = alerts.concat(await getAlertList(account, outsideZones, deviceParams, device_id));
  }

  if (insideZones.length) {
    alerts = alerts.concat(await getAlertList(account, insideZones, deviceParams, device_id));
  }

  for (const alert of alerts) {
    const mockData = {
      variable: "location",
      value: `${coordinates.lat},${coordinates.lng}`,
      origin: device_id,
      time: new Date(),
    };

    await sendAlert(account, context, org_id, { ...alert, data: mockData });
  }
}

/**
 * Add this function to alert Handler in order to add the needed variable for geofence events
 * @param account Account
 * @param devToStoreAlert Organization/Group/Etc device that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function geofenceAlertCreate(account: Account, devToStoreAlert: Device, action_id: string, structure: ActionStructureParams) {
  const condition = structure.trigger_value as string;
  devToStoreAlert.sendData({
    variable: "action_geofence",
    value: structure.name,
    metadata: { color: condition.includes("Sair") || condition.includes("Outside") ? "green" : "red" },
    serie: action_id,
  });
}

/**
 * Add this function to alert Handler when editing geofence alerts.
 * @param account Account
 * @param devToStoreAlert Organization/Group/Etc device that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function geofenceAlertEdit(account: Account, devToStoreAlert: Device, action_id: string, structure: ActionStructureParams) {
  await devToStoreAlert.deleteData({ variables: "action_geofence", series: action_id });

  geofenceAlertCreate(account, devToStoreAlert, action_id, structure);
}

export { IGeofenceAlert, geofenceAlertEdit, geofenceAlertCreate, geofenceAlertTrigger };
