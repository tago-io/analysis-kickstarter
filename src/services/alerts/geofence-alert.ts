import { isPointWithinRadius } from "geolib";

import { Resources } from "@tago-io/sdk";
import { ActionInfo, ConfigurationParams, Data, TagoContext } from "@tago-io/sdk/lib/types";

import { ActionStructureParams } from "./register";
import { IAlertTrigger, sendAlert } from "./send-alert";

/**
 * The function checks if our device is inside a polygon geofence
 * @param point Point on map, latitude and longitude
 * @param geofence List of the geofences
 */
function insidePolygon(point: [number, number], geofence: Data["metadata"]) {
  if (!geofence) {
    throw "Invalid geofence";
  }
  const x = point[1];
  const y = point[0];
  let inside = false;
  for (let i = 0, j = geofence.length - 1; i < geofence.length; j = i++) {
    const xi = geofence[i][0];
    const yi = geofence[i][1];
    const xj = geofence[j][0];
    const yj = geofence[j][1];
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
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

/**
 * The function checks if our device is inside any geofence
 * @param point Point on map, latitude and longitude
 * @param geofence_list List of the geofences
 */
function checkZones(point: [number, number], geofence_list: Data["metadata"][]): IGeofenceMetadata[] {
  let geofences: IGeofenceMetadata[] = [];

  // The line below gets all Polygon geofences that we may have.
  const polygons = geofence_list.filter((x) => x?.geolocation.type === "Polygon");
  if (polygons.length > 0) {
    // Here we check if our device is inside any Polygon geofence using our function above.
    const pass_check = polygons.map((x) => insidePolygon(point, x?.geolocation.coordinates[0]));
    geofences = geofences.concat(getGeofenceResult(pass_check, polygons));
  }

  // The line below gets all Point (circle) geofences that we may have.
  const circles = geofence_list.filter((x) => x?.geolocation.type === "Point");
  if (circles.length === 0) {
    return geofences;
  }

  // Here we check if our device is inside any Point geofence using a third party library called geolib.
  const pass_check = circles.map((x) =>
    isPointWithinRadius(
      { latitude: point[1], longitude: point[0] },
      {
        latitude: x?.geolocation.coordinates[0],
        longitude: x?.geolocation.coordinates[1],
      },
      x?.geolocation.radius
    )
  );

  geofences = geofences.concat(getGeofenceResult(pass_check, circles));

  return geofences;
}

type IAlertToBeSent = Omit<IAlertTrigger, "data">;
/**
 * The function returns the list of alerts that are outside the geofence zone
 * @param outsideZones Zones that are outside the geofence
 * @param deviceParams Configuration parameter of the device
 * @param device_id Device id
 */
async function getAlertList(outsideZones: IGeofenceMetadata[], deviceParams: ConfigurationParams[], device_id: string) {
  const alerts: IAlertToBeSent[] = [];
  for (const item of outsideZones) {
    const action_info: ActionInfo = await Resources.actions.info(item.event);
    if (!action_info) {
      console.debug(`Action not found ${item.event}`);
      continue;
    }
    if (!action_info.trigger || !action_info.tags) {
      throw "Invalid action";
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

    if (!send_to || !action_type) {
      throw "Invalid action type and send to";
    }
    const action_device = action_info.tags.find((x) => x.key === "device")?.value as string;

    await Resources.devices.paramSet(device_id, { ...alertParam, key: item.event, value: "geofence", sent: true });
    alerts.push({ action_id: item.event, send_to, type: action_type, device: action_device });
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
 * @param context Context of the analysis, to retrieve the token
 * @param locationData lat and lng of device current position
 */
async function geofenceAlertTrigger(context: TagoContext, locationData: IGeofenceAlert) {
  const { coordinates, device_id } = locationData;

  const { tags } = await Resources.devices.info(device_id);
  const org_id = tags.find((tag) => tag.key === "organization_id")?.value as string;
  const group_id = tags.find((tag) => tag.key === "group_id")?.value as string;
  const subgroup_id = tags.find((tag) => tag.key === "subgroup_id")?.value as string;
  let geofences: Data[] = [];

  if (org_id) {
    let geofence_list = await Resources.devices.getDeviceData(org_id, { variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, device: org_id } }));
    geofences = geofences.concat(geofence_list);
  }

  // Support for group owners, if the application has it.
  if (group_id) {
    let geofence_list = await Resources.devices.getDeviceData(group_id, { variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, device: group_id } }));
    geofences = geofences.concat(geofence_list);
  }

  // Support for subgroup owners, if the application has it.
  if (subgroup_id) {
    let geofence_list = await Resources.devices.getDeviceData(subgroup_id, { variables: "geofence_alerts", qty: 100 });
    geofence_list = geofence_list.map((x) => ({ ...x, metadata: { ...x.metadata, device: subgroup_id } }));
    geofences = geofences.concat(geofence_list);
  }

  // Filter the geofences and send the alerts if any
  const geofenceMetadataList = geofences.map((geofences) => geofences.metadata) as IGeofenceMetadata[];
  const zones = checkZones([coordinates.lng, coordinates.lat], geofenceMetadataList);

  const outsideZones = geofenceMetadataList.filter((x) => x.eventColor === "green" && !zones.some((y) => y.event === x.event));
  const insideZones = geofenceMetadataList.filter((x) => x.eventColor === "red" && zones.find((y) => y.event === x.event));

  const alertsToReset = geofenceMetadataList.filter((x) => !outsideZones.some((y) => y.event === x.event) && !insideZones.some((y) => y.event === x.event));

  const deviceParams = await Resources.devices.paramList(device_id);
  for (const alert of alertsToReset) {
    const param = deviceParams.find((param) => param.key.includes(alert.event));
    if (!param) {
      continue;
    }

    void Resources.devices.paramSet(device_id, { ...param, sent: false });
  }

  let alerts: IAlertToBeSent[] = [];
  if (outsideZones.length > 0) {
    alerts = alerts.concat(await getAlertList(outsideZones, deviceParams, device_id));
  }

  if (insideZones.length > 0) {
    alerts = alerts.concat(await getAlertList(insideZones, deviceParams, device_id));
  }

  for (const alert of alerts) {
    const mockData: any = {
      variable: "location",
      value: `${coordinates.lat},${coordinates.lng}`,
      device: device_id,
      time: new Date(),
    };

    await sendAlert(context, org_id, { ...alert, data: mockData });
  }
}

/**
 * Add this function to alert Handler in order to add the needed variable for geofence events
 * @param device_id Organization/Group/Etc device id that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function geofenceAlertCreate(device_id: string, action_id: string, structure: ActionStructureParams) {
  const condition = structure.trigger_value as string;
  await Resources.devices.sendDeviceData(device_id, {
    variable: "action_geofence",
    value: structure.name,
    metadata: { color: condition.includes("Sair") || condition.includes("Outside") ? "green" : "red" },
    group: action_id,
  });
}

/**
 * Add this function to alert Handler when editing geofence alerts.
 * @param device_id Organization/Group/Etc device id that will have the event stored
 * @param action_id Id of the action
 * @param structure structure of the action
 */
async function geofenceAlertEdit(device_id: string, action_id: string, structure: ActionStructureParams) {
  await Resources.devices.deleteDeviceData(device_id, { variables: "action_geofence", groups: action_id });

  void geofenceAlertCreate(device_id, action_id, structure);
}

export { IGeofenceAlert, geofenceAlertEdit, geofenceAlertCreate, geofenceAlertTrigger };
