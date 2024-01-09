import { Resources } from "@tago-io/sdk";
import { DeviceListScope, RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { fetchDeviceList } from "../../lib/fetch-device-list";
import { fetchUserList } from "../../lib/fetch-user-list";

/**
 * Main function of deleting organizations
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment is a variable sent by the analysis
 */
async function orgDel({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  if (!scope[0]) {
    return console.error("Not a valid TagoIO Data");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  //id of the org device
  const org_id = scope[0].device;

  const params = await Resources.devices.paramList(org_id);

  const org_auth_token = params.find((x) => x.key === "org_auth_token");
  //deleting token
  // const [org_auth_token] = await Resources.devices.getDeviceData(config_id, { variables: "org_auth_token", qty: 1, groups: org_id });
  if (org_auth_token?.value) {
    // This should be made because the Acess Management doesn't have permission to delete tokens
    const service_authorization = new Resources({ token: environment.ACCOUNT_TOKEN }).serviceAuthorization;
    await service_authorization.tokenDelete(org_auth_token.value);
  }

  //delete from settings_device
  await Resources.devices.deleteDeviceData(config_id, { groups: org_id, qty: 9999 });

  //deleting users (organization's user)
  const user_accounts = await fetchUserList({ tags: [{ key: "organization_id", value: org_id }] });
  if (user_accounts) {
    for (const user of user_accounts) {
      await Resources.run.userDelete(user.id);
    }
  }

  //deleting organization's device

  const devices = await fetchDeviceList({ tags: [{ key: "organization_id", value: org_id }] });

  if (devices) {
    for (const x of devices) {
      await Resources.devices.delete(x.id); /*passing the device id*/
    }
  }

  return console.debug("Organization deleted");
}

export { orgDel };
