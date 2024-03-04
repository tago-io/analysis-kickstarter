import { Resources } from "@tago-io/sdk";
import { DeviceListItem, DeviceQuery } from "@tago-io/sdk/lib/types";

type FetchDeviceResponse = Pick<DeviceListItem, "id" | "name" | "bucket" | "tags" | "last_input" | "created_at">;
/**
 * Fetchs the device list using filters.
 * Automatically apply pagination to not run on throughtput errors.
 * @param filter filter conditions of the request
 * @returns
 */
async function fetchDeviceList(filter: DeviceQuery["filter"]): Promise<FetchDeviceResponse[]> {
  let device_list: FetchDeviceResponse[] = [];

  for (let index = 1; index < 9999; index++) {
    const amount = 100;
    const foundDevices = await Resources.devices.list({
      page: index,
      fields: ["id", "name", "tags", "last_input", "created_at"],
      filter,
      resolveBucketName: false,
      amount,
    });

    device_list = device_list.concat(foundDevices);
    if (foundDevices.length < amount) {
      return device_list;
    }
  }

  return device_list;
}

export { fetchDeviceList, FetchDeviceResponse };
