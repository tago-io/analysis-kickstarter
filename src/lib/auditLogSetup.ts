import { Account, Device } from "@tago-io/sdk";
import { parseTagoObject } from "./data.logic";

/**
 * Function that edit user information and send audit log
 * @param account Account instanced class
 * @param device Device instanced class
 */
export default function auditLogSetup(account: Account, device: Device) {
  return async function _(new_value: string, siren_state?: string, user_id?: string) {
    if (!new_value) {
      throw "Missing new_value";
    }
    let name = "System";
    if (user_id) {
      name = (await account.run.userInfo(user_id))?.name || "System";
      if (name === "System") {
        user_id = "System";
      }
    }

    device.sendData(
      parseTagoObject(
        {
          audit_user: { value: user_id || "System", metadata: { label: name } },
          audit_new_value: new_value,
          siren_state: siren_state,
        },
        String(new Date().getTime())
      )
    );
  };
}
