import { Resources } from "@tago-io/sdk";

/**
 * Get the ANalysis ID by it's tag export_id value
 * @param resources Resources with Account Token
 * @param tagValue tag value string
 * @returns
 */
async function getAnalysisByTagID(resources: Resources, tagValue: string, tagKey: string = "export_id") {
  // Should be pass the Resources with Account Token because the Access Management doesn't have access to the Analysis
  const [analysis] = await resources.analysis.list({
    amount: 1,
    fields: ["id", "tags"],
    filter: { tags: [{ key: tagKey, value: tagValue }] },
  });
  if (!analysis) {
    throw `Analysis ${tagValue} not found`;
  }

  return analysis?.id;
}

/**
 * Get the Dashboard ID by it's tag export_id value
 * @param tagValue tag value string
 * @returns
 */
async function getDashboardByTagID(tagValue: string, tagKey: string = "export_id") {
  const [dash] = await Resources.dashboards.list({
    amount: 1,
    fields: ["id", "tags"],
    filter: { tags: [{ key: tagKey, value: tagValue }] },
  });
  if (!dash) {
    throw `Dashboard ${tagValue} not found`;
  }

  return dash?.id;
}

/**
 * Get the Mutable Device ID of a device using the device_type tag
 * Matches the tag device_id with the deviceID param
 * @param deviceID
 * @param deviceType tag value string
 * @returns
 */
async function getLinkedDeviceID(deviceID: string, deviceType: string = "device-storage") {
  const [device] = await Resources.devices.list({
    amount: 1,
    fields: ["id", "tags"],
    filter: {
      tags: [
        { key: "device_id", value: deviceID },
        { key: "device_type", value: deviceType },
      ],
    },
  });

  if (!device) {
    throw `Linked Device ${deviceID} not found`;
  }

  return device.id;
}

/**
 * Get the Dashboard ID by it's tag connector_id value
 * @param tagValue tag value string
 * @returns
 */
async function getDashboardByConnectorID(connector_id: string) {
  const [dash] = await Resources.dashboards.list({ amount: 1, fields: ["id", "tags"], filter: { tags: [{ key: "connector_id", value: connector_id }] } });
  if (!dash) {
    throw `Dashboard ${connector_id} not found`;
  }

  return { id: dash?.id };
}

export { getDashboardByTagID, getAnalysisByTagID, getLinkedDeviceID, getDashboardByConnectorID };
