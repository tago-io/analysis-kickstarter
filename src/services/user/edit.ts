import { Resources } from "@tago-io/sdk";
import { UserListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { RouterConstructorData } from "../../types";
import { getAccessLabel } from "./register";

async function editOrgUserInfo(user_id: string, userField: string, fieldValue: string, organization_id: string) {
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

  await Resources.entities.editEntityData(organization_id, {
    ...userData,
    [userField]: fieldValue,
  });
}

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

  const user_name = scope[0]?.name as string;
  const user_phone = scope[0]?.phone as string;
  const user_access = scope[0]?.["tags.access"] as string;

  const user_exists = await Resources.run.userInfo(user_id);
  if (!user_exists) {
    throw "User does not exist";
  }

  const organization_id = user_exists.tags.find((tag) => tag.key === "organization_id")?.value;
  if (!organization_id) {
    throw "Organization ID not found";
  }

  if (user_name) {
    await editOrgUserInfo(user_id, "user_name", user_name, organization_id);
    await Resources.run.userEdit(user_id, { name: user_name });
  }
  if (user_phone) {
    await editOrgUserInfo(user_id, "user_phone", user_phone, organization_id);
    await Resources.run.userEdit(user_id, { phone: user_phone });
  }
  if (user_access) {
    await editOrgUserInfo(user_id, "user_access", user_access, organization_id);
    const user_access_label = getAccessLabel(user_access);
    await editOrgUserInfo(user_id, "user_access_label", user_access_label, organization_id);
  }
  return console.debug("User edited!");
}

export { userEdit };
