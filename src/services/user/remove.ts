import { Resources } from "@tago-io/sdk";

import { RouterConstructorData } from "../../types";

/**
 * Function that remove user from organization
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function userDel({ scope, environment }: RouterConstructorData) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  // @ts-expect-error user is not defined on sdk types
  const user_id = scope[0].user;
  if (!user_id) {
    throw new Error("User id not found");
  }
  //checking if user exists
  const user_exists = await Resources.run.userInfo(user_id);
  if (!user_exists) {
    throw "User does not exist";
  }

  const org_id = user_exists.tags.find((x) => ["user_org_id", "organization_id"].includes(x.key))?.value;
  if (!org_id) {
    throw "Organization id not found";
  }

  //collecting org id
  const group_id = user_exists.tags.find((x) => x.key === "group_id")?.value;

  // block the user from deleting himself
  if (environment._user_id === user_id) {
    throw "User tried to delete himself";
  }

  if (group_id) {
    await Resources.devices.deleteDeviceData(group_id, { groups: user_id, qty: 9999 });
  }

  await Resources.devices.deleteDeviceData(config_id, { groups: user_id, qty: 9999 });
  await Resources.devices.deleteDeviceData(org_id, { groups: user_id, qty: 9999 });
  //deleting user
  await Resources.run.userDelete(user_id).then((msg) => console.debug(msg));
  return;
}

export { userDel };
