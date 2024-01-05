import { Account } from "@tago-io/sdk";

async function findAnalysisByExportID(account: Account, export_id: string) {
  const [analysis] = await account.analysis.list({ amount: 1, fields: ["id", "tags"], filter: { tags: [{ key: "export_id", value: export_id }] } });
  if (!analysis) {
    throw `Analysis ${export_id} not found`;
  }

  return analysis?.id;
}

async function findDashboardByExportID(account: Account, export_id: string) {
  const [dash] = await account.dashboards.list({ amount: 1, fields: ["id", "tags"], filter: { tags: [{ key: "export_id", value: export_id }] } });
  if (!dash) {
    throw `Dashboard ${export_id} not found`;
  }

  return dash?.id;
}

async function findDashboardByConnectorID(account: Account, connector_id: string) {
  const [dash] = await account.dashboards.list({ amount: 1, fields: ["id", "tags"], filter: { tags: [{ key: "connector_id", value: connector_id }] } });
  if (!dash) {
    throw `Dashboard ${connector_id} not found`;
  }

  return { id: dash?.id };
}

/**
 * Get the Dashboard ID by it's tag export_id value
 * @param tagValue tag value string
 * @returns
 */
async function GetDashboardByTagID(account: Account, tagValue: string, tagKey: string = "export_id") {
  const [dash] = await account.dashboards.list({
    amount: 1,
    fields: ["id", "tags"],
    filter: { tags: [{ key: tagKey, value: tagValue }] },
  });
  if (!dash) {
    throw `Dashboard ${tagValue} not found`;
  }

  return dash?.id;
}

export { findDashboardByExportID, findDashboardByConnectorID, findAnalysisByExportID, GetDashboardByTagID };
