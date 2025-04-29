import { Analysis, Resources } from "@tago-io/sdk";

import { fetchDeviceList } from "../lib/fetch-device-list";

/**
 * Function to start the analysis and clear variables from devices of type organization
 * @param context
 * @param scope
 */
async function startAnalysis() {
  console.log("Starting analysis");
  const deviceList = await fetchDeviceList({ tags: [{ key: "device_type", value: "organization" }] });

  for (const device of deviceList) {
    await Resources.devices.deleteDeviceData(device.id, { variables: ["device_qty", "plan_usage"], qty: 9999 });
  }

  const organizations = await Resources.devices.list({ filter: { tags: [{ key: "device_type", value: "organization" }] }, fields: ["created_at", "name"], amount: 9999 });

  // delete organizations older than 3 months and not tagoio
  for (const organization of organizations) {
    const createdAt = organization.created_at;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const organizationTypeTag = organization.tags.find((tag) => tag.key === "organization_type")?.value;

    if (createdAt < threeMonthsAgo && organizationTypeTag !== "tagoio") {
      console.debug(`Deleting organization ${organization.name} because it was created at ${createdAt}`);
      const organizationDevices = await Resources.devices.list({ filter: { tags: [{ key: "organization_id", value: organization.id }] } });
      for (const device of organizationDevices) {
        await Resources.devices.delete(device.id);
      }

      const organizationActions = await Resources.actions.list({ filter: { tags: [{ key: "organization_id", value: organization.id }] } });
      for (const action of organizationActions) {
        await Resources.actions.delete(action.id);
      }

      const organizationUsers = await Resources.run.listUsers({ filter: { tags: [{ key: "organization_id", value: organization.id }] } });
      for (const user of organizationUsers) {
        await Resources.run.userDelete(user.id);
      }
    }
  }
  console.log("Analysis finished");
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}
