import { Resources } from "@tago-io/sdk";
import { TagsObj } from "@tago-io/sdk/lib/types";

import { initializeValidation } from "../../lib/validation";
import { RouterConstructorData } from "../../types";
import { actionModel } from "./action.model";

interface ReportActionStructure {
  org_id: string;
  group: string;
  cron: string; //chronological string in the TagoIO structure e.g. "00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed" -> 8am once each day
  active: boolean;
  tags?: TagsObj[];
}

/**
 * Function that create the chronological string
 * @param report_time  e.g. "08:00"
 * @param report_days  e.g. "Mon;Tue;Wed;Thu;Fri;Sat;Sun"
 */
function getCronString(report_time: string, report_days: string): string {
  // 00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed
  const time = `${report_time?.slice(3, 5)} ${report_time?.slice(0, 2)}`;
  let week_days = report_days?.replace(/\s/g, ""); //removing white spaces
  week_days = week_days.replaceAll(";", ","); //if existed replacing ";" for ","

  return `${time} */1 * ${week_days}`;
}

/**
 * Main function of creating reports
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function reportAdd({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const org_id = scope[0].device;

  const action_group = scope[0].group;

  const validate = initializeValidation("report_validation", org_id);
  await validate("Registering...", "warning").catch((error) => console.log(error));

  if (!environment._user_id) {
    throw await validate("This should be run in Tago RUN need a environment._user_id", "danger").catch((error) => console.log(error));
  }

  const report_active = scope.find((x) => x.variable === "new_report_active");
  const report_time = scope.find((x) => x.variable === "new_report_time");
  const report_days = scope.find((x) => x.variable === "new_report_days");
  const report_contact = scope.find((x) => x.variable === "new_report_contact");
  const report_sensors = scope.find((x) => x.variable === "new_report_sensors");
  const report_group = scope.find((x) => x.variable === "new_report_group");

  if (!report_active || !report_time || !report_days || !report_contact || !action_group) {
    throw new Error("Missing parameters report_active, report_time, report_days, report_contact or action_group");
  }

  const action_tags: TagsObj[] = [
    { key: "action_group", value: action_group },
    { key: "report_contact", value: report_contact.value as string },
  ];

  //removing "new_" from each variable name of the scope
  let new_scope = scope.map((data) => ({ ...data, variable: data?.variable?.replace("new_", "") }));
  new_scope = new_scope.filter((x) => x.variable);

  if (report_sensors) {
    //send new line to by sensor - report table
    const table_data = new_scope;
    await Resources.devices.sendDeviceData(org_id, table_data);

    action_tags.push({ key: "sensor_list", value: report_sensors?.value as string });
  } else if (report_group) {
    //send new line to by group - report table, inserting bysite_ as a prefix for each variable name
    const table_data = new_scope.map((data) => ({ ...data, variable: "bysite_" + data.variable }));
    await Resources.devices.sendDeviceData(org_id, table_data);

    action_tags.push({ key: "group_list", value: report_group?.value as string });
  }

  const cron = getCronString(report_time.value as string, report_days.value as string);

  const action_object: ReportActionStructure = {
    org_id,
    group: action_group,
    cron,
    active: report_active?.value === "true" ? true : false,
    tags: action_tags,
  };

  // action_tags.push({ key: "action_group", value: action_group }, { key: "report_contact", value: report_contact.value as string });
  const user_info = await Resources.run.userInfo(environment._user_id);
  const timezone = user_info?.timezone || "America/Sao_Paulo";
  const action_model = await actionModel(action_object, timezone, environment);
  console.debug(action_model);
  await Resources.actions.create(action_model).catch(async (error) => {
    throw await validate(error, "danger").catch((error) => console.log(error));
  });

  return validate("Report schedule successfully set!", "success").catch((error) => console.log(error));
}

export { reportAdd, ReportActionStructure, getCronString };
