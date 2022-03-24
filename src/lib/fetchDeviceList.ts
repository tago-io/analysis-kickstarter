import { Account } from "@tago-io/sdk";
import { TagsObj } from "@tago-io/sdk/out/common/common.types";
import { DeviceInfo, DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file to fetch device list through pagination
// ? ====================================================================================

async function fetchDeviceList(account: Account, tags?: TagsObj[], id?: string): Promise<DeviceListItem[]> {
  let org_list: DeviceListItem[] = [];

  for (let index = 1; index < 9999; index++) {
    const org_devices = await account.devices.list({
      page: index,
      fields: ["id", "name", "bucket", "tags", "last_input"],
      filter: {
        id: id || undefined,
        tags: tags || undefined,
      },
      resolveBucketName: false,
    });

    if (org_devices.length) {
      org_list = org_list.concat(org_devices);
    } else {
      return org_list;
    }
  }
}

export { fetchDeviceList };
