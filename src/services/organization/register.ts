import { Resources } from "@tago-io/sdk";
import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { EntityData, RouterConstructorEntity } from "../../types";
import { organizationModel } from "./organization.model";
import { getZodError } from "../../lib/get-zod-error";
import { entityNameExists } from "../../lib/entity-name-exists";
import { createURL } from "../../lib/url-creator";
import { TagResolver } from "../../lib/edit.tag";
import { getPlanEntity } from "../plan/register";
interface installEntityParam {
  new_org_name: string;
  new_org_plan_id: string;
}
/**
 * Function that create organizations
 * @param new_org_name Organization name configured by the user
 * @param new_org_plan_id  User configured plan
 */
async function installEntity({ new_org_name, new_org_plan_id }: installEntityParam) {
  //structuring data
  const entity = {
    name: new_org_name,
    schema: {
      user_id: {
        type: "string",
        required: true,
      },
      user_name: {
        type: "string",
        required: true,
      },
      user_email: {
        type: "string",
        required: true,
      },
      user_phone: {
        type: "string",
        required: false,
      },
      user_access: {
        type: "string",
        required: true,
      },
      user_access_label: {
        type: "string",
        required: true,
      },
    },
    index: {
      user_id_index: {
        action: "create",
        fields: ["user_id"]
      }
    }
  };

  //creating new device
  const new_org = await Resources.entities.create(entity);

  //inserting device id -> so we can reference this later
  await Resources.entities.edit(new_org.id, {
    tags: [
      { key: "organization_id", value: new_org.id },
      { key: "user_org_id", value: new_org.id },
      { key: "entity_type", value: "organization" },
      { key: "plan_group", value: new_org_plan_id },
    ],
  });

  return new_org.id;
}

/**
 * Retrieves and parses form fields from the provided data scope.
 *
 * @param {Data[]} scope - An array of data objects containing form field information.
 * @returns {Promise<ParsedResult>} A promise that resolves to the parsed result of the form fields.
 *
 * @throws {Error} If parsing the form fields fails.
 */
async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const newOrgName = scope.find((x) => x.new_org_name)?.new_org_name as string;
  const newOrgPlan = scope.find((x) => x.new_org_plan)?.new_org_plan as string;
  const newOrgAddress = scope.find((x) => x.new_org_address)?.new_org_address as string;

  const result = await organizationModel.parseAsync({
    name: newOrgName,
    address: newOrgAddress,
    plan: newOrgPlan,
  });

  return result;
}


/**
 * Main function of creating organizations
 * @param context Context is a variable sent by the analysis
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment is a variable sent by the analysis
 */
async function orgAdd({ scope, environment }: RouterConstructorEntity) {
  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const validate = initializeValidation("org_validation", config_id);
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

  const entity = await getPlanEntity().catch(async (error) => {
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  });

  const [plan_data] = await Resources.entities.getEntityData(entity.id, {
    filter: {
      id: formFields.plan,
    },
    index: "id_idx",
    amount: 1,
   });

  if (!plan_data) {
    const error = "Plan error, internal problem.";
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }
  const plan_name = plan_data.name as string;

  const is_device_name_exists = await entityNameExists({ name: formFields.name, tags: [{ key: "entity_type", value: "organization" }] });

  if (is_device_name_exists) {
    const error = `The Organization with name ${formFields.name} already exists.`;
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  }

  const service_authorization = new Resources({ token: environment.ACCOUNT_TOKEN }).serviceAuthorization;
  const user_auth_token = await service_authorization.tokenCreate({
    name: `${formFields.name}_token`,
    permission: "full",
  });

  //need device id to configure group in parseTagoObject
  //creating new device
  const entity_id = await installEntity({ new_org_name: formFields.name, new_org_plan_id: plan_data.id as string });

  const dash_organization_id = await getDashboardByTagID("dash_sensor_list").catch(async (error) => {
    await validate(error, "danger").catch((error) => console.log(error));
    throw new Error(error);
  });

  const dashUrl = createURL()
    .setBase(`/dashboards/info/${dash_organization_id}`)
    .addParam("settings", config_id)
    .addParam("org_dev", entity_id)
    .build();

  const orgEntity = await Resources.entities.info(entity_id);

  if (!orgEntity) {
    await validate("Organization not found.", "danger").catch(console.log);
    throw new Error("Organization not found.");
  }

  const tagResolver = TagResolver(orgEntity.tags, false, "entity");
  tagResolver.setTag("dashboard_url", dashUrl);
  tagResolver.setTag("org_address", formFields.address as string);
  tagResolver.setTag("org_auth_token", user_auth_token.token);
  tagResolver.setTag("_param", "");
  tagResolver.setTag("plan_name", plan_name);
  tagResolver.setTag("plan_email_limit", String(plan_data.email_usg_limit_qty_m));
  tagResolver.setTag("plan_sms_limit", String(plan_data.sms_usg_limit_qty_m));
  tagResolver.setTag("plan_notif_limit", String(plan_data.push_notification_usg_limit_qty_m));
  tagResolver.setTag("plan_data_retention", String(plan_data.data_retention_m));
  tagResolver.setTag("plan_email_limit_usage", "0");
  tagResolver.setTag("plan_sms_limit_usage", "0");
  tagResolver.setTag("plan_notif_limit_usage", "0");
  await tagResolver.apply(entity_id);

  //TODO: Await front end fix to send data to settings with the correct location
  // const org_data = {
  //   org_id: { value: entity_id, metadata: { label: formFields.name }, location: formFields.address },
  // };

  // await Resources.devices.sendDeviceData(config_id, parseTagoObject(org_data, entity_id));

  //TODO: Verify if this is needed
  // await Resources.devices.sendDeviceData(config_id, { ...plan_data });

  await validate("#VAL.ORGANIZATION_SUCCESSFULLY_CREATED#", "success").catch((error) => console.log(error));

  return entity_id;
}

export { orgAdd };
