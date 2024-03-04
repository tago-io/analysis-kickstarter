/*
 * KickStarter Analysis
 * Send Report
 *
 * This analysis is responsible to generate the PDF and its content.
 *
 * Reports are generated when:
 * - On the dashboard Report, through Send Now button;
 * - When setting a scheduled report, an action will trigger this script.
 */

import dayjs from "dayjs";

import { Analysis, Resources } from "@tago-io/sdk";
import { ActionInfo, TagoContext, UserInfo } from "@tago-io/sdk/lib/types";

import { htmlBody } from "../lib/html-body";
import { createPDF } from "../lib/send-pdf";
import { checkAndChargeUsage } from "../services/plan/check-and-charge-usage";

interface SensorData {
  name: string;
  status: string;
  battery: string;
  rssi: string;
  date: string;
}

/**
 * Function that resolves the report of the organization and send it to the user
 * @param context Context is a variable sent by the analysis
 * @param action_info Action information of the action that triggered the analysis
 * @param org_id Organization ID to resolve the report
 * @param via Via is a string that defines how the report was triggered
 */
async function resolveReport(context: TagoContext, action_info: ActionInfo, org_id: string, via?: string) {
  if (!context || !action_info || !org_id) {
    throw "Missing Router parameter";
  }
  const { name: org_name } = await Resources.devices.info(org_id);

  let sensor_id_list: string[] = [];

  if (!action_info.tags) {
    throw console.debug("action_info.tags is undefined");
  }

  const action_sensor_list = action_info.tags.find((x) => x.key === "sensor_list")?.value;
  const action_group_list = action_info.tags.find((x) => x.key === "group_list")?.value;

  if (action_sensor_list) {
    sensor_id_list = action_sensor_list.split(", ");
  } else if (action_group_list) {
    const site_id_list = action_group_list.split(", ");

    for (const site_id of site_id_list) {
      const site_dev_id_list = await Resources.devices.getDeviceData(site_id, { variables: "dev_id", qty: 9999 });
      for (const dev_id_data of site_dev_id_list) {
        const existing_sensor = sensor_id_list.find((id) => id === (dev_id_data?.value as string));

        if (!existing_sensor) {
          sensor_id_list.push(dev_id_data.value as string);
        }
      }
    }
  } else {
    throw console.debug("Error - no sensor on scheduled action");
  }

  const report_data: SensorData[] = [];

  for (const id of sensor_id_list) {
    const sensor_info = await Resources.devices.info(id);

    if (!sensor_info) {
      continue; //sensor has been deleted
    }

    const sensor_data = await Resources.devices.getDeviceData(id, { variables: ["temperature", "humidity", "compressor", "battery", "rssi"], qty: 1 });
    // const status_history = sensor_data.find((x) => x.variable === "status_history");
    const temperature = sensor_data.find((x) => x.variable === "temperature");
    const humidity = sensor_data.find((x) => x.variable === "humidity");
    const compressor = sensor_data.find((x) => x.variable === "compressor");
    const temp_status = `Temp: ${temperature?.value ?? "N/A"}${temperature?.unit ?? ""}`;
    const hum_status = `Hum: ${humidity?.value ?? "N/A"}${humidity?.unit ?? ""}`;
    const compressor_status = `Compressor: ${compressor?.value ?? "N/A"}`;
    const status_history = `${temp_status} | ${hum_status} | ${compressor_status}`;
    const battery = sensor_data.find((x) => x.variable === "battery");
    const rssi = sensor_data.find((x) => x.variable === "rssi");

    report_data.push({
      name: sensor_info.name,
      status: status_history,
      battery: `${(battery?.value as string) ?? "N/A"}${battery?.unit ?? ""}`,
      rssi: (rssi?.value as string) ?? "N/A",
      date: dayjs(String(sensor_info.last_input)).format("YYYY-MM-DD HH:mm:ss"),
    });
  }

  const table_header = `
  <th>Sensor</th>
  <th>Status</th>
  <th>Battery</th>
  <th>RSSI</th>
  <th>Last Input</th>`;

  let final_html_body = htmlBody;
  final_html_body = final_html_body.replace("$TABLE_HEADER$", table_header);

  let report_table = ``;

  for (const data of report_data) {
    let report_row = `
    <tr>
      <td>$NAME$</td>
      <td>$STATUS$</td>
      <td>$BATTERY$</td>
      <td>$RSSI$</td>
      <td>$DATE$</td>
    </tr>`;
    report_row = report_row.replace("$NAME$", data.name);
    report_row = report_row.replace("$STATUS$", data?.status || "No data sent yet");
    report_row = report_row.replace("$BATTERY$", data.battery);
    report_row = report_row.replace("$RSSI$", data.rssi);
    report_row = report_row.replace("$DATE$", data.date);

    report_table = report_table.concat(report_row);
  }

  final_html_body = final_html_body.replace("$REPORT_TABLE$", report_table);

  const org_indicators = await Resources.devices.getDeviceData(org_id, { variables: ["device_qty"], qty: 1 });
  const total_qty = org_indicators[0].value || "0";
  const active_qty = org_indicators[0]?.metadata?.active_qty || "0";
  const inactive_qty = org_indicators[0]?.metadata?.inactive_qty || "0";

  final_html_body = final_html_body.replace("$TOTAL_QTY$", String(total_qty));
  final_html_body = final_html_body.replace("$ACTIVE_QTY$", active_qty);
  final_html_body = final_html_body.replace("$INACTIVE_QTY$", inactive_qty);

  const action_report_contact = action_info.tags.find((x) => x.key === "report_contact")?.value;

  if (!action_report_contact) {
    throw console.debug("action_report_contact not found");
  }

  const users_id_list: string[] = action_report_contact.split(", ");

  //fetch users set first

  const users_info_list: UserInfo[] = [];
  const all_users_label: string[] = [];

  for (const user_id_from_list of users_id_list) {
    const current_user_info = await Resources.run.userInfo(user_id_from_list).catch((error) => console.debug(error));
    if (!current_user_info) {
      //user has been deleted
      continue;
    }
    users_info_list.push(current_user_info);
    all_users_label.push(current_user_info?.email);
  }

  //check if users are invited and still existing first -> charge from which will be actually being sent.
  const to_dispatch_qty = users_info_list.length;

  const plan_service_status = await checkAndChargeUsage(context, org_id, to_dispatch_qty, "email");

  if (plan_service_status === false) {
    return await Resources.devices.sendDeviceData(org_id, [
      {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} report(s) was not successful. No email service limit available, check your plan status or get in touch with us.`,
      },
      { variable: "report_sent", value: `Report has not been sent. No plan service usage available.`, metadata: { users: "-" } },
    ]);
  }

  let filename: string | undefined;
  if (users_id_list.length > 0 && plan_service_status) {
    filename = await createPDF(context, final_html_body, users_info_list, org_name, org_id);
  } else if (users_id_list.length === 0) {
    return await Resources.devices.sendDeviceData(org_id, [{ variable: "report_sent", value: `Report has not been sent. No user registered.`, metadata: { users: "-" } }]);
  }

  const all_users_string = all_users_label.join(", ");

  const url_file = filename ? `https://api.tago.io/file/61b2f46e561da800197a9c43${filename}` : "-";
  await Resources.devices.sendDeviceData(org_id, [{ variable: "report_sent", value: `Report has been sent. Via: ${via}.`, metadata: { users: all_users_string, url_file } }]);
}

/**
 * Function to start the analysis
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 */
async function startAnalysis(context: TagoContext, scope: any) {
  console.debug("Running Analysis");

  let org_id: string | undefined = "";

  const action_id = context.environment.find((x) => x.key === "_action_id")?.value as string;

  if (action_id) {
    //THROUGH ACTION
    const action_info = await Resources.actions.info(action_id);

    const { tags } = action_info;

    if (!tags) {
      return console.debug("tags not found");
    }

    org_id = tags.find((x) => x.key === "organization_id")?.value;
    if (!org_id) {
      throw "organization_id not found";
    }

    void resolveReport(context, action_info, org_id, "Squeduled Action");
  } else if (scope) {
    //THROUGH BUTTON SEND NOW
    const action_group = scope[0]?.group;

    const [action_registered] = await Resources.actions.list({
      page: 1,
      fields: ["id", "name", "tags"],
      filter: {
        tags: [{ key: "action_group", value: action_group }],
      },
      amount: 1,
    });

    if (!action_registered.tags) {
      return console.debug("ERROR - No action found");
    }

    org_id = action_registered.tags.find((x) => x.key === "organization_id")?.value;
    if (!org_id) {
      throw "organization_id not found";
    }

    void resolveReport(context, action_registered, org_id, "Button");
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
