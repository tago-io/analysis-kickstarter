/*
 * KickStarter Analysis
 * Send Report
 *
 * This analysis is responsible to generate the PDF and its content.
 *
 * Reports are generated when:
 * - On the dashboard Report, through Send Now button;
 * - When setting a scheduled report, an action will trigger this script.
 *
 * How to setup this analysis
 * Make sure you have the following enviroment variables:
 * - account_token: the value must be a token from your profile. See how to generate account-token at: https://help.tago.io/portal/en/kb/articles/495-account-token.
 */

import dayjs from "dayjs";

import { Account, Analysis, Device, Utils } from "@tago-io/sdk";
import { ActionInfo } from "@tago-io/sdk/out/modules/Account/actions.types";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";

import html_body from "../lib/html_body";
import sendPDF from "../lib/sendPDF";
import checkAndChargeUsage from "../services/plan/checkAndChargeUsage";

interface SensorData {
  name: string;
  status: string;
  battery: string;
  rssi: string;
  date: string;
}

/**
 * Function that resolves the report of the organization and send it to the user
 * @param account Account instance class
 * @param context Context is a variable sent by the analysis
 * @param action_info Action information of the action that triggered the analysis
 * @param org_id Organization ID to resolve the report
 * @param via Via is a string that defines how the report was triggered
 */
async function resolveReport(account: Account, context: TagoContext, action_info: ActionInfo, org_id: string, via?: string) {
  if (!account || !context || !action_info || !org_id) {
    throw "Missing Router parameter";
  }
  const org_dev = await Utils.getDevice(account, org_id);
  const { name: org_name } = await org_dev.info();

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
      const site_dev = await Utils.getDevice(account, site_id);
      const site_dev_id_list = await site_dev.getData({ variables: "dev_id", qty: 9999 });
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

  for (const sensor of sensor_id_list) {
    const sensor_dev = await Utils.getDevice(account, sensor).catch((msg) => console.debug(msg));
    if (!sensor_dev) {
      continue; //sensor has been deleted
    }
    const last_input = (await sensor_dev.info()).last_input;
    const sensor_data = await sensor_dev.getData({ variables: ["temperature", "humidity", "compressor", "battery", "rssi"], qty: 1 });
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

    const { name: sensor_name } = await sensor_dev.info();

    report_data.push({
      name: sensor_name,
      status: status_history,
      battery: `${(battery?.value as string) ?? "N/A"}${battery?.unit ?? ""}`,
      rssi: (rssi?.value as string) ?? "N/A",
      date: dayjs(String(last_input)).format("YYYY-MM-DD HH:mm:ss"),
    });
  }

  const table_header = `
  <th>Sensor</th>
  <th>Status</th>
  <th>Battery</th>
  <th>RSSI</th>
  <th>Last Input</th>`;

  let final_html_body = html_body;
  final_html_body = final_html_body.replace("$TABLE_HEADER$", table_header);

  let report_table = ``;

  report_data.forEach((data) => {
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
  });

  final_html_body = final_html_body.replace("$REPORT_TABLE$", report_table);

  const org_indicators = await org_dev.getData({ variables: ["device_qty"], qty: 1 });
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
    const current_user_info = await account.run.userInfo(user_id_from_list).catch((msg) => console.debug(msg));
    if (!current_user_info) {
      //user has been deleted
      continue;
    }
    users_info_list.push(current_user_info);
    all_users_label.push(current_user_info?.email);
  }

  //check if users are invited and still existing first -> charge from which will be actually being sent.
  const to_dispatch_qty = users_info_list.length;

  const plan_service_status = await checkAndChargeUsage(account, context, org_id, to_dispatch_qty, "email");

  if (plan_service_status === false) {
    return await org_dev.sendData([
      {
        variable: "plan_status",
        value: `Attempt to send ${to_dispatch_qty} report(s) was not successful. No email service limit available, check your plan status or get in touch with us.`,
      },
      { variable: "report_sent", value: `Report has not been sent. No plan service usage available.`, metadata: { users: "-" } },
    ]);
  }

  let filename: string | undefined;
  if (users_id_list.length > 0 && plan_service_status) {
    filename = await sendPDF(context, final_html_body, users_info_list, org_name, org_id);
  } else if (users_id_list.length == 0) {
    return await org_dev.sendData([{ variable: "report_sent", value: `Report has not been sent. No user registered.`, metadata: { users: "-" } }]);
  }

  const all_users_string = all_users_label.join(", ");

  const url_file = filename ? `https://api.tago.io/file/651e993977b37400096c7860${filename}` : "-";
  await org_dev.sendData([{ variable: "report_sent", value: `Report has been sent. Via: ${via}.`, metadata: { users: all_users_string, url_file } }]);
}

/**
 * Function to start the analysis
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 */
async function startAnalysis(context: TagoContext, scope: any) {
  console.debug("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  } else if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  let org_id: string | undefined = "";

  const action_id = context.environment.find((x) => x.key === "_action_id")?.value as string;

  if (action_id) {
    //THROUGH ACTION
    const action_info = await account.actions.info(action_id);

    const { tags } = action_info;

    if (!tags) {
      return console.debug("tags not found");
    }

    org_id = tags.find((x) => x.key === "organization_id")?.value;
    if (!org_id) {
      throw "organization_id not found";
    }

    resolveReport(account, context, action_info, org_id, "Squeduled Action");
  } else if (scope) {
    //THROUGH BUTTON SEND NOW
    const action_group = scope[0]?.group;

    const [action_registered] = await account.actions.list({
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

    resolveReport(account, context, action_registered, org_id, "Button");
  }
}

if (!process.env.T_TEST) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}

export { startAnalysis };
