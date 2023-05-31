import { Utils } from "@tago-io/sdk";
import { RouterConstructorData } from "../../types";

/**
 * Function that remove user from organization
 * @param config_dev Device that contains the configuration
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param account Account instanced class
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  if (!account || !environment || !scope || !config_dev || !context) {
    throw new Error("Missing parameters");
  }
  // @ts-expect-error user is not defined on sdk types
  const user_id  = scope[0].user;
  if(!user_id) {
    throw new Error("User id not found");
  }
  //checking if user exists
  const user_exists = await account.run.userInfo(user_id);
  if (!user_exists) {
    throw "User does not exist";
  }

  const org_id = user_exists.tags.find((x) => ["user_org_id", "organization_id"].includes(x.key))?.value;
  if (!org_id) {
    throw "Organization id not found";
  }
  const org_dev = await Utils.getDevice(account, org_id);

  //collecting org id
  const group_id = user_exists.tags.find((x) => x.key === "group_id")?.value;

  if (!org_dev) {
    throw "Organization device not found";
  }

  // block the user from deleting himself
  if (environment._user_id === user_id) {
    // await org_dev.sendData(scope);
    throw "User tried to delete himself";
  }

  if (group_id) {
    const group_dev = await Utils.getDevice(account, group_id);
    await group_dev.deleteData({ groups: user_id, qty: 9999 });
  }
  await config_dev.deleteData({ groups: user_id, qty: 9999 });
  await org_dev.deleteData({ groups: user_id, qty: 9999 });
  //deleting user
  await account.run.userDelete(user_id).then((msg) => console.debug(msg));
  return;
};
