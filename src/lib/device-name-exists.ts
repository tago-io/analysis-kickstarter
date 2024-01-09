import { TagsObj } from "@tago-io/sdk/lib/types";

import { fetchDeviceList } from "./fetch-device-list";

interface DeviceSource {
  name: string;
  tags: TagsObj[];
  isEdit?: boolean;
}

/**
 * The Device Creation and Edit utilize this method.
 * @description Check if device name exists
 * @param {string} name Device name
 * @param {TagsObj[]} tags Device tags
 * @param {boolean} isEdit When editing a device, if a device with the same name already exists, it should return two devices.
 * This is because the frontend automatically handles the editing process.
 */
async function deviceNameExists({ name, tags, isEdit = false }: DeviceSource) {
  const device = await fetchDeviceList({
    name,
    tags,
  });

  if (isEdit && device.length > 1) {
    return true;
  } else if (!isEdit && device.length > 0) {
    return true;
  }

  return false;
}

export { deviceNameExists };
