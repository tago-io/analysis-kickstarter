// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file is global types, it's used to remove "implicitly has an 'any' type" errors.
// ? ====================================================================================

import { Types, Device, Account } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { RouterConstructor } from "@tago-io/sdk/out/modules/Utils/router/router";

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
