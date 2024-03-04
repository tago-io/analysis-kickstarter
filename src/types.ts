// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file is global types, it's used to remove "implicitly has an 'any' type" errors.
// ? ====================================================================================

import { Device } from "@tago-io/sdk";
import { RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { Data } from "@tago-io/sdk/lib/types";

interface DeviceCreated {
  bucket_id: string;
  device_id: string;
  device: Device;
}

interface RouterConstructorData extends Omit<RouterConstructor, "scope"> {
  scope: Data[];
}

interface RouterConstructorDevice extends Omit<RouterConstructor, "scope"> {
  scope: { device: string; [key: string]: string }[];
}

export { DeviceCreated, RouterConstructorData, RouterConstructorDevice };
