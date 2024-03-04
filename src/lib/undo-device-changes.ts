import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { DeviceInfo } from "@tago-io/sdk/lib/types";

import { ParamResolver } from "./edit.params";
import { TagResolver } from "./edit.tag";

/**
 * @description Undo device changes
 */
async function undoDeviceChanges({ scope, deviceInfo }: { scope: DeviceListScope[]; deviceInfo: DeviceInfo }) {
  const paramList = await Resources.devices.paramList(deviceInfo.id);
  const paramResolver = ParamResolver(paramList);
  const tagResolver = TagResolver(deviceInfo.tags);

  // Device List editions are always scoped to a single device.
  const deviceScope = scope[0];

  for (const key of Object.keys(deviceScope)) {
    if (key === "name") {
      const oldName = deviceScope?.old?.[key] as string;
      // eslint-disable-next-line no-undef
      await Resources.devices.edit(deviceInfo.id, { name: oldName });
    } else if (key.includes("param.")) {
      const paramKey = key.replace("param.", "");
      const oldValue = deviceScope?.old?.[key] as string;
      paramResolver.setParam(paramKey, oldValue);
    } else if (key.includes("tags.")) {
      const tagKey = key.replace("tags.", "");
      const oldValue = deviceScope?.old?.[key] as string;
      tagResolver.setTag(tagKey, oldValue);
    }
  }

  if (paramResolver.hasChanged()) {
    await paramResolver.apply(deviceInfo.id);
  }

  if (tagResolver.hasChanged()) {
    await tagResolver.apply(deviceInfo.id);
  }
}

export { undoDeviceChanges };
