import { Account, Types } from "@tago-io/sdk";

/* eslint-disable no-loop-func */
function replaceJSON(item: any, replaceObj: any) {
  item = JSON.stringify(item);
  Object.keys(replaceObj).forEach((x) => {
    item = item.replace(new RegExp(x, "g"), replaceObj[x]);
  });
  item = JSON.parse(item);

  return item;
}
type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export default async function InstallTemplate(account: Account, templates: string[], deviceObj: {}, replaceObj: any) {
  const dashboards = await Promise.all(templates.map((id) => account.template.installTemplate(id, { replace: replaceObj })));
  const dash_list = dashboards.map((x) => x.dashboard as string);

  dash_list.forEach((dashboard: string, i) => {
    replaceObj[templates[i]] = dashboard;
  });

  dash_list.forEach(async (dashboard: string) => {
    let dash_info = (await account.dashboards.info(dashboard)) as Writeable<Types.Account.Dashboards.DashboardInfo> & { setup: {} };
    const hidden_var = dash_info.tags.find((x) => x.key === "hidden");
    dash_info.visible = !hidden_var;
    dash_info = replaceJSON(dash_info, replaceObj);
    dash_info.setup = {};

    await account.dashboards.edit(dashboard, dash_info);

    const widget_list = await Promise.all(dash_info.arrangement.map((x) => account.dashboards.widgets.info(dashboard, x.widget_id)));

    for (let x of widget_list) {
      // Change any "Username" in widget variables, labels, etc to "John Doe".
      x = replaceJSON(x, replaceObj);

      account.dashboards.widgets.edit(dashboard, x.id, x);
    }
  });

  return replaceObj;
}
