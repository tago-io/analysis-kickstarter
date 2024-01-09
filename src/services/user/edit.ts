import { Resources } from "@tago-io/sdk";
import { UserListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";

import { RouterConstructorData } from "../../types";

/**
 * Function that edit user information
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function userEdit({ scope, environment }: RouterConstructorData & { scope: UserListScope[] }) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const user_id = scope[0].user;

  const user_active = scope[0]?.["tags.active"];
  const user_name = scope[0]?.name as string;
  const user_phone = scope[0]?.phone as string;

  const user_exists = await Resources.run.userInfo(user_id);
  if (!user_exists) {
    throw "User does not exist";
  }

  const new_user_info: any = {};

  if (user_active) {
    await Resources.run.userEdit(user_id, { active: JSON.parse(user_active) });
  }

  if (user_name) {
    //fetching prev data
    const [user_name_config_dev] = await Resources.devices.getDeviceData(config_id, { variables: "user_name", qty: 1, groups: user_id });

    await Resources.devices.editDeviceData(config_id, { ...user_name_config_dev, value: user_name });

    new_user_info.name = user_name;
    await Resources.run.userEdit(user_id, new_user_info);
  }
  if (user_phone) {
    //fetching prev data
    const [user_phone_config_dev] = await Resources.devices.getDeviceData(config_id, { variables: "user_phone", qty: 1, groups: user_id });

    await Resources.devices.editDeviceData(config_id, { ...user_phone_config_dev, value: user_phone });

    new_user_info.phone = user_phone;
    await Resources.run.userEdit(user_id, new_user_info);
  }
  return console.debug("User edited!");
}

export { userEdit };
