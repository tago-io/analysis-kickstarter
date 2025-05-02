import { Resources } from "@tago-io/sdk";
import { TagsObj } from "@tago-io/sdk/lib/types";

import { parseTagoObject } from "../../lib/data.logic";
import { inviteUser } from "../../lib/register-user";
import { initializeValidation } from "../../lib/validation";
import { EntityData } from "../../types";
import { RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { userModel } from "./user.model";
import { getZodError } from "../../lib/get-zod-error";
interface UserData {
  name: string;
  email: string;
  phone?: string | number | boolean | void;
  timezone: string;
  tags?: TagsObj[];
  password?: string;
  id?: string;
}

/**
 * Function that handle phone number
 * @param phone_number Phone number
 */
function phoneNumberHandler(phone_number: string) {
  //US as default
  let country_code = "+1";
  let resulted_phone_number: string;

  if (phone_number.slice(0, 1).includes("+")) {
    country_code = phone_number.slice(0, 3);
    phone_number = phone_number.slice(3);
  }
  //removing special characters
  resulted_phone_number = phone_number.replaceAll(/[^\w\s]/gi, "");

  resulted_phone_number = `${country_code}${resulted_phone_number}`;

  return resulted_phone_number;
}

/**
 * Retrieves and validates user form fields from the provided data scope.
 *
 * @param {EntityData[]} scope - An array of data objects containing user form field information
 * @returns {Promise<IUser>} A promise that resolves to the validated user data
 *
 * @throws {ZodError} If validation of the form fields fails
 *
 * @example
 * const scope = [
 *   { new_user_name: "John Doe" },
 *   { new_user_email: "john@example.com" },
 *   { new_user_phone: "+1234567890" },
 *   { new_user_access: "admin" }
 * ];
 * const userData = await getFormFields(scope);
 */
async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const name = scope.find((x) => x.new_user_name)?.new_user_name as string;
  const email = scope.find((x) => x.new_user_email)?.new_user_email as string;
  const phone = scope.find((x) => x.new_user_phone)?.new_user_phone as string;
  const access = scope.find((x) => x.new_user_access)?.new_user_access as string;

  const result = await userModel.parseAsync({
    name: name,
    email: email,
    phone: phoneNumberHandler(phone),
    access: access,
  });

  return result;
}

//registered by admin Resources.

/**
 * Function that register new user
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function userAdd({ context, scope, environment }: RouterConstructor) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const org_id = scope[0].entity;

  //validation
  const validate = initializeValidation("user_validation", config_id);
  await validate("#VAL.RESGISTERING#", "warning").catch((error) => console.log(error));

  const formFields = await getFormFields(scope)
    .catch(getZodError)
    .catch(async (error) => {
      await validate(error, "danger");
      throw error;
    });

  if (!formFields) {
    const error = "Form fields are required.";
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }

  const [user_exists] = await Resources.run.listUsers({
    page: 1,
    amount: 1,
    filter: { email: formFields.email },
  });

  if (user_exists) {
    throw await validate("#VAL.USER_ALREADY_EXISTS#", "danger").catch((error) => console.log(error));
  }

  //creating user
  const resources_with_account_token = new Resources({ token: environment.ACCOUNT_TOKEN });
  const { timezone } = await resources_with_account_token.account.info();

  const new_user_data: UserData = {
    name: formFields.name,
    email: formFields.email,
    phone: formFields.phone,
    timezone: timezone,
    tags: [
      {
        key: "organization_id",
        value: org_id,
      },
      {
        key: "access",
        value: formFields.access,
      },
      {
        key: "active",
        value: "true",
      },
    ],
  };

  const { url: run_url } = await resources_with_account_token.run.info();

  //registering user
  const new_user_id = await inviteUser(resources_with_account_token, context, new_user_data, run_url).catch(async (error) => {
    throw await validate(error, "danger").catch((error) => console.log(error));
  });

  let user_access_label: string | undefined = "";

  if (formFields.access === "admin") {
    user_access_label = "Administrator";
  } else if (formFields.access === "orgadmin") {
    user_access_label = "Organization Admin";
  } else if (formFields.access === "guest") {
    user_access_label = "Guest";
  }

  const userDataEntity = {
    user_id: new_user_id,
    user_name: formFields.name,
    user_email: formFields.email,
    user_phone: formFields.phone,
    user_access: formFields.access,
    user_access_label: user_access_label,
  };

  let userData = parseTagoObject(
    {
      user_id: new_user_id,
      user_name: formFields.name,
      user_email: formFields.email,
      user_phone: formFields.phone,
      user_access: formFields.access,
      user_access_label: user_access_label,
    },
    new_user_id
  );

  // if (new_user_access.value === "admin") {
  //   user_data = user_data.concat([{ variable: "user_admin", value: new_user_id, group: new_user_id, metadata: { label: new_user_name.value as string } }]);
  // }

  //sending to org device
  await Resources.entities.sendEntityData(org_id, [userDataEntity]);

  //sending to admin device (settings_device)
  await Resources.devices.sendDeviceData(config_id, userData);

  return validate("#VAL.USER_SUCCESSFULLY_INVITED_AN_EMAIL_WILL_BE_SENT_WITH_THE_CREDENTIALS_TO_THE_NEW_USER#", "success");
}

export { userAdd };
