import { Resources } from "@tago-io/sdk";
import { DashboardInfo } from "@tago-io/sdk/lib/types";

/* eslint-disable no-loop-func */
function replaceJSON(item: any, replaceObj: any) {
  item = JSON.stringify(item);
  for (const x of Object.keys(replaceObj)) {
    item = item.replaceAll(new RegExp(x, "g"), replaceObj[x]);
  }
  item = JSON.parse(item);

  return item;
}
type Writeable<T> = { -readonly [P in keyof T]: T[P] };

async function InstallTemplate(templates: string[], replaceObj: any) {
  const dashboards = await Promise.all(templates.map((id) => Resources.template.installTemplate(id, { replace: replaceObj })));
  const dash_list = dashboards.map((x) => x.dashboard as string);

  for (const [i, dashboard] of dash_list.entries()) {
    replaceObj[templates[i]] = dashboard;
  }

  for (const dashboard of dash_list) {
    let dash_info = (await Resources.dashboards.info(dashboard)) as Writeable<DashboardInfo> & { setup: {} };
    const hidden_var = dash_info.tags?.find((x) => x.key === "hidden");
    dash_info.visible = !hidden_var;
    dash_info = replaceJSON(dash_info, replaceObj);
    dash_info.setup = {};

    await Resources.dashboards.edit(dashboard, dash_info);

    if (!dash_info.arrangement) {
      continue;
    }

    const widget_list = await Promise.all(dash_info.arrangement.map((x) => Resources.dashboards.widgets.info(dashboard, x.widget_id)));

    for (let x of widget_list) {
      // Change any "Username" in widget variables, labels, etc to "John Doe".
      x = replaceJSON(x, replaceObj);

      if (!x.id) {
        continue;
      }

      await Resources.dashboards.widgets.edit(dashboard, x.id, x);
    }
  }

  return replaceObj;
}

export { InstallTemplate };
