import { Resources } from "@tago-io/sdk";

import { RouterConstructorData } from "../../types";
import { actionModel } from "./action.model";
import { getCronString, ReportActionStructure } from "./create";

/**
 * Main function of editing reports
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function reportEdit({ context, scope, environment }: RouterConstructorData) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }
  const org_id = scope[0].device;

  const action_group = scope[0].group as string;

  const report_active = scope.find((x) => x.variable === "report_active" || x.variable === "bysite_report_active");
  const report_time = scope.find((x) => x.variable === "report_time" || x.variable === "bysite_report_time");
  const report_days = scope.find((x) => x.variable === "report_days" || x.variable === "bysite_report_days");
  const report_contact = scope.find((x) => x.variable === "report_contact" || x.variable === "bysite_report_contact");
  const report_sensors = scope.find((x) => x.variable === "report_sensors" || x.variable === "bysite_report_sensors");
  const report_group = scope.find((x) => x.variable === "report_group" || x.variable === "bysite_report_group");

  const [action_registered] = await Resources.actions.list({
    page: 1,
    fields: ["id", "name", "tags", "active"],
    filter: {
      tags: [{ key: "action_group", value: action_group }],
    },
    amount: 1,
  });

  let action_info;

  if (action_registered) {
    console.debug("Editting report action");
    action_info = await Resources.actions.info(action_registered?.id);
  }

  const action_object: ReportActionStructure = {
    org_id,
    group: action_group,
    cron: "",
    active: false,
    tags: [{ key: "action_group", value: action_group }], //sensor/group, contact, org_id
  };
  if (!action_registered.tags) {
    throw new Error("Action not found in Tago");
  }

  if (!action_object.tags) {
    action_object.tags = [{ key: "action_group", value: action_group }];
  }
  //if new sensor or new group
  if (report_sensors) {
    action_object.tags.push({ key: "sensor_list", value: (report_sensors?.value as string).replaceAll(";", ", ") });
  } else {
    const sensor_list_tag = action_registered?.tags.find((x) => x.key === "sensor_list");
    //if it previously has a sensor_list tag
    if (sensor_list_tag) {
      action_object.tags.push(sensor_list_tag);
    }
  }
  if (report_group) {
    action_object.tags.push({ key: "group_list", value: (report_group?.value as string).replaceAll(";", ", ") });
  } else {
    //if it previously has a sensor_list tag
    const group_list_tag = action_registered.tags.find((x) => x.key === "group_list");
    if (group_list_tag) {
      action_object.tags.push(group_list_tag);
    }
  }

  let old_time = ((action_info?.trigger as any)[0].cron as string).slice(0, 5);
  //time from action comes inverted, so we need to invert back so we can re-use getCronString function e.g. "45 23" -> "23 45"
  old_time = `${old_time.slice(3, 5)} ${old_time.slice(0, 2)}`;
  const old_week_days = ((action_info?.trigger as any)[0].cron as string).slice(12);

  const new_time = report_time?.value as string;
  const new_week_days = report_days?.value as string;

  action_object.cron = getCronString(new_time || old_time, new_week_days || old_week_days);
  if (report_active?.value) {
    action_object.active = report_active.value === "true" ? true : false; //type boolean only
  } else {
    action_object.active = action_registered.active as boolean;
  }

  if (report_contact) {
    action_object.tags.push({ key: "report_contact", value: (report_contact?.value as string).replaceAll(";", ", ") });
  } else {
    const contact_tag = action_registered.tags.find((x) => x.key === "report_contact");
    if (!contact_tag) {
      throw new Error("Missing report_contact tag");
    }
    action_object.tags.push(contact_tag);
  }

  const user_info = await Resources.run.userInfo(environment._user_id);
  const timezone = user_info?.timezone || "America/Sao_Paulo";
  const action_model = await actionModel(action_object, timezone);

  await Resources.actions
    .edit(action_registered.id, action_model)
    .then((msg) => console.debug(msg))
    .catch((error) => console.debug(error));
}

export { reportEdit };
