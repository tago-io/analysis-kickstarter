import { Account } from "@tago-io/sdk";
import { TagsObj } from "@tago-io/sdk/out/common/common.types";
import { DeviceInfo, DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file to fetch device list through pagination
// ? ====================================================================================

async function fetchDeviceList(account: Account, tags?: TagsObj[], id?: string): Promise<DeviceListItem[]> {
  let device_list: DeviceListItem[] = [];

  for (let index = 1; index < 9999; index++) {
    const found_devices = await account.devices.list({
      page: index,
      fields: ["id", "name", "bucket", "tags", "last_input"],
      filter: {
        id: id || undefined,
        tags: tags || undefined,
      },
      resolveBucketName: false,
      amount: 100,
    });

    if (!found_devices.length) {
      return device_list;
    }
    device_list = device_list.concat(found_devices);
  }
}

export { fetchDeviceList };
