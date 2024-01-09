import { Resources } from "@tago-io/sdk";

import { parseTagoObject } from "./data.logic";

/**
 * Function that edit user information and send audit log
 * @param device_id Device ID
 */
function auditLogSetup(device_id: string) {
  return async function _(new_value: string, siren_state?: string, user_id?: string) {
    if (!new_value) {
      throw "Missing new_value";
    }
    let name = "System";
    if (user_id) {
      name = (await Resources.run.userInfo(user_id))?.name || "System";
      if (name === "System") {
        user_id = "System";
      }
    }

    await Resources.devices.sendDeviceData(
      device_id,
      parseTagoObject(
        {
          audit_user: { value: user_id || "System", metadata: { label: name } },
          audit_new_value: new_value,
          siren_state: siren_state,
        },
        String(Date.now())
      )
    );
  };
}

export { auditLogSetup };
