import { Resources } from "@tago-io/sdk";
import { UserListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { RouterConstructorData } from "../../types";

/**
 * Function that remove user from organization
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function userDel({ scope, environment }: RouterConstructorData & { scope: UserListScope[] }) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const user_id = scope[0].user;
  if (!user_id) {
    throw new Error("User id not found");
  }
  //checking if user exists
  const user_exists = await Resources.run.userInfo(user_id);
  if (!user_exists) {
    throw "User does not exist";
  }

  const organization_id = user_exists.tags.find((x) => ["user_org_id", "organization_id"].includes(x.key))?.value;
  if (!organization_id) {
    throw "Organization id not found";
  }

  // block the user from deleting himself
  if (environment._user_id === user_id) {
    throw "User tried to delete himself";
  }

  await Resources.devices.deleteDeviceData(config_id, { groups: user_id, qty: 9999 });

  const [userData] = await Resources.entities.getEntityData(organization_id, {
    filter: {
      user_id: user_id,
    },
    index: "user_id_index",
    amount: 1,
  });

  if (!userData) {
    throw "User does not exist";
  }

  // deleting user data from organization
  await Resources.entities.deleteEntityData(organization_id, { ids: [userData.id] });

  //deleting user
  await Resources.run.userDelete(user_id).then((msg) => console.debug(msg));
  return;
}

export { userDel };
