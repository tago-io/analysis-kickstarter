import { Resources } from "@tago-io/sdk";
import { DeviceListScope, RouterConstructor } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { AnalysisEnvironment, ConfigurationParams } from "@tago-io/sdk/lib/types";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { EntityData, RouterConstructorEntity } from "../../types";
import { TagResolver } from "../../lib/edit.tag";
import { entityNameExists } from "../../lib/entity-name-exists";
import { undoEntityChanges } from "../../lib/undo-entity-changes";

/**
 * Function that handle organization name change
 */
async function handleOrgNameChange(config_id: string, scope: DeviceListScope[], environment: AnalysisEnvironment, org_id: string) {
  const new_org_name = scope[0]["name"];
  if (new_org_name) {
    const is_device_name_exists = await entityNameExists({ name: new_org_name as string, tags: [{ key: "device_type", value: "organization" }], isEdit: true });

    if (is_device_name_exists) {
      const orgInfo = await Resources.entities.info(org_id);
      await undoEntityChanges({ entityInfo: orgInfo, scope });
      await sendNotificationFeedback({ environment, message: `The organization with name ${new_org_name} already exists.` });
      throw `The organization with name ${new_org_name} already exists.`;
    }

    await Resources.devices.deleteDeviceData(config_id, { variables: "org_id", groups: org_id });
    const [org_id_data] = await Resources.devices.getDeviceData(config_id, { variables: "org_id", groups: org_id, qty: 1 });
    await Resources.devices.sendDeviceData(config_id, { ...org_id_data, metadata: { ...org_id_data.metadata, label: new_org_name } });
    await Resources.devices.edit(org_id, { name: new_org_name });
  }
}

/**
 * Function that handle auth token change
 */
async function handleAuthTokenChange(config_id: string, org_id: string, org_auth_token_param: ConfigurationParams) {
  if (org_auth_token_param) {
    const [org_auth_token] = await Resources.devices.getDeviceData(config_id, { variables: "org_auth_token", qty: 1, groups: org_id });
    if (org_auth_token?.value) {
      await Resources.serviceAuthorization.tokenEdit(org_auth_token.value as string, org_auth_token_param.value);
    }
  }
}

/**
 * Function that handle plan name change
 */
async function handlePlanNameChange(scope: EntityData[], org_id: string) {
  const new_plan_name = scope[0]["tags.plan_name"];
  if (new_plan_name) {
    const [plan_data] = await Resources.entities.getEntityData(org_id, {
      filter: {
        name: new_plan_name as string,
      },
      index: "name_index",
      amount: 1,
     });

    if (!plan_data) {
      throw "Plan not found";
    }

    const org_info = await Resources.entities.info(org_id);
    const tagResolver = TagResolver(org_info.tags);
    tagResolver.setTag("plan_group", plan_data.id as string);
    tagResolver.setTag("plan_name", plan_data.value as string);
    tagResolver.setTag("plan_email_limit", String(plan_data.email_limit));
    tagResolver.setTag("plan_sms_limit", String(plan_data.sms_limit));
    tagResolver.setTag("plan_notif_limit", String(plan_data.notif_limit));
    tagResolver.setTag("plan_data_retention", String(plan_data.data_retention));
    await tagResolver.apply(org_id);
  }
}

/**
 * Function that handle org address change
 */
async function handleOrgAddressChange(config_id: string, scope: DeviceListScope[], org_id: string) {
  const new_org_address = scope[0]["param.org_address"];
  if (new_org_address) {
    const coordinates = (new_org_address as string).split(";")[0];
    const [org_id_data] = await Resources.devices.getDeviceData(config_id, { variables: "org_id", groups: org_id, qty: 1 });
    await Resources.devices.deleteDeviceData(config_id, { variables: "org_id", groups: org_id });
    await Resources.devices.sendDeviceData(config_id, {
      ...org_id_data,
      metadata: { ...org_id_data.metadata },
      location: { lat: Number(coordinates.split(",")[0]), lng: Number(coordinates.split(",")[1]) },
    });
  }
}

/**
 * Main function of editing organizations
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function orgEdit({ scope, environment }: RouterConstructor & { scope: DeviceListScope[] }) {
  if (!scope || !environment) {
    throw "Missing Router parameter";
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  if (!scope[0]) {
    return console.error("Not a valid TagoIO Data");
  }

  const org_id = scope[0].entity;
  const orgInfo = await Resources.entities.info(org_id);
  const org_auth_token_param = orgInfo.tags.find((x) => x.key === "org_auth_token") as ConfigurationParams;

  await handleOrgNameChange(config_id, scope, environment, org_id);
  await handleAuthTokenChange(config_id, org_id, org_auth_token_param);
  await handlePlanNameChange(scope, org_id);
  await handleOrgAddressChange(config_id, scope, org_id);

  return console.debug("edited!");
}

export { orgEdit };
