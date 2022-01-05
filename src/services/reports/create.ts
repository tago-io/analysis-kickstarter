import { Utils } from "@tago-io/sdk";
import validation from "../../lib/validation";
import { RouterConstructorData } from "../../types";
import { actionModel } from "./action.model";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const org_id = scope[0].origin as string;
  const org_dev = await Utils.getDevice(account, org_id);

  const action_serie = scope[0].serie;

  const validate = validation("report_validation", org_dev);
  validate("Registering...", "warning");

  const report_active = scope.find((x) => x.variable === "report_active" || x.variable === "bysite_report_active");
  const report_time = scope.find((x) => x.variable === "report_time" || x.variable === "bysite_report_time");
  const report_days = scope.find((x) => x.variable === "report_days" || x.variable === "bysite_report_days");
  const report_contact = scope.find((x) => x.variable === "report_contact" || x.variable === "bysite_report_contact");
  const report_sensors = scope.find((x) => x.variable === "report_sensors" || x.variable === "bysite_report_sensors");
  const report_group = scope.find((x) => x.variable === "report_group" || x.variable === "bysite_report_group");

  const [action_registered] = await account.actions.list({
    page: 1,
    fields: ["id", "name", "tags", "active"],
    filter: {
      tags: [{ key: "action_serie", value: action_serie }],
    },
    amount: 1,
  });

  //no trigger info in list -> will use info instead
  let action_info;

  if (action_registered) {
    console.log("Editting report action");
    action_info = await account.actions.info(action_registered?.id);
  }

  let action_tags: [{ key: string; value: string }];

  if (report_sensors) {
    //send new line to report table
    if (!action_registered) {
      // const dont_run_analysis_twice: Data = { variable: "dont_run_analysis_twice", value: "dont_run_analysis_twice", origin: "", time: new Date() };
      const table_data = scope.filter((x) => x.variable);
      await org_dev.sendData(table_data);
    }

    if (action_registered && report_sensors?.value) {
      action_tags = [{ key: "sensor_list", value: (report_sensors?.value as string).replace(/;/g, ", ") }];
    } else {
      action_tags = [{ key: "sensor_list", value: report_sensors?.value as string }];
    }
  } else if (report_group && !action_registered) {
    //send new line to report table
    if (!action_registered) {
      const new_scope = scope.map((data) => ({ ...data, variable: "bysite_" + data.variable }));
      await org_dev.sendData(new_scope);
    }

    action_tags = [{ key: "group_list", value: report_group?.value as string }];
  }

  let old_time;
  let old_week_days;

  if (action_info) {
    old_time = ((action_info.trigger as any)[0].cron as string).substring(0, 5);
    old_week_days = ((action_info.trigger as any)[0].cron as string).substring(12);
  }

  // 00 08 */1 * Fri,Mon,Sat,Sun,Thu,Tue,Wed
  const time = report_time?.value ? `${(report_time?.value as string)?.slice(3, 5)} ${(report_time?.value as string)?.slice(0, 2)}` : old_time;
  const week_days = (report_days?.value as string)?.replace(/\s/g, "") || old_week_days; //removing white spaces
  // let cron = time.includes("undefined") ? null : `${time} */1 * ${week_days}`;
  let cron = `${time} */1 * ${week_days}`;

  //REGISTERING NEW

  if (!action_registered && !action_info) {
    action_tags.push({ key: "action_serie", value: action_serie }, { key: "report_contact", value: report_contact.value as string });
    const action_model = await actionModel(account, org_id, action_serie, cron, report_active?.value === "true" ? true : false, action_tags);
    const { action: action_id } = await account.actions.create(action_model).catch((e) => {
      throw validate(e, "danger");
    });
    return validate("Report schedule successfuly set!", "success");
  }

  //EDIT

  let action_active: boolean;
  if (report_active?.value === "true") {
    action_active = true;
  } else if (report_active?.value === "false") {
    action_active = false;
  } else {
    action_active = action_registered.active;
  }

  const to_be_filtered = ["organization_id"];

  //if new time/week (to review -> only time / only week day)
  if (cron) {
    cron = cron.replace(/;/g, ",");
  }

  const tags_to_be_pushed = [];

  //if new sensors
  if (action_tags) {
    if (action_tags.find((x) => x.key === "sensor_list")) {
      to_be_filtered.push("sensor_list");
    } else if (action_tags.find((x) => x.key === "group_list")) {
      to_be_filtered.push("group_list");
    }

    tags_to_be_pushed.push(...action_tags);
  }

  //if new contact
  if (report_contact) {
    to_be_filtered.push("report_contact");
    tags_to_be_pushed.push({ key: "report_contact", value: (report_contact?.value as string).replace(/;/g, ", ") });
  }

  action_registered.tags = action_registered.tags.filter((tag) => !to_be_filtered.includes(tag.key));

  action_registered.tags.push(...tags_to_be_pushed);

  const action_model = await actionModel(account, org_id, action_serie, cron || (action_info.trigger as any)[0].cron, action_active, action_registered.tags as any);

  await account.actions
    .edit(action_registered.id, action_model)
    .then((msg) => console.log(msg))
    .catch((msg) => console.log(msg));

  return validate("Report schedule successfuly set!", "success");
};
