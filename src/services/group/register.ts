import { Resources } from "@tago-io/sdk";
import { getDashboardByTagID } from "../../lib/find-resource";
import { initializeValidation } from "../../lib/validation";
import { EntityData, RouterConstructorEntity } from "../../types";
import { fetchEntityList } from "../../lib/fetch-entity-list";
import { getZodError } from "../../lib/get-zod-error";
import { groupModel, IGroup } from "./group.model";
import { entityNameExists } from "../../lib/entity-name-exists";
import { createURL } from "../../lib/url-creator";

interface installEntityParam {
  new_group_name: string;
  org_id: string;
  new_group_address?: string;
}

/**
 * Uploads a default layer image to a newly created group
 * @param new_group_id - The ID of the newly created group to upload the layer to
 * @returns A promise that resolves when the layer data has been sent to the entity
 */
async function uploadDefaultLayer(new_group_id: string) {
  const dataToSend = {
    layer: "Layer #1",
    path: "buckets/6127d8d10ceb400012b53fc3/layers/Floor Plan Right.png",
    url: "https://api.tago.io/file/61b2f46e561da800197a9c43/Floor%20Plan%20with%20Watermark.png",
  };

  await Resources.entities.sendEntityData(new_group_id, dataToSend);
}

/**
 * Sends group data to an entity and creates a dashboard URL
 * @param group_id - ID of the group entity to send data to
 * @param org_id - ID of the organization this group belongs to
 * @param formFields - Form fields containing group details like name and address
 * @throws {Error} If dashboard lookup fails
 */
async function sendGroupData(group_id: string, org_id: string, formFields: IGroup, new_group_id: string) {
  const dash_organization_id = await getDashboardByTagID("dash_groupview").catch(async (error) => {
    throw new Error(error);
  });

  const dashUrl = createURL()
    .setBase(`/dashboards/info/${dash_organization_id}`)
    .addParam("group_dev", group_id)
    .addParam("org_dev", org_id)
    .build();

  const dataToSend = {
    group_id: new_group_id,
    group_name: formFields.name,
    group_address: formFields.address,
    dashboard_url: dashUrl,
  };
  await Resources.entities.sendEntityData(group_id, dataToSend);
}
/**
 * Function that create groups
 * @param new_group_name Group name that will be created
 * @param org_id Organization id that the group will be created
 */
async function installEntity(entityParams: installEntityParam) {

  const entity = {
    name: entityParams.new_group_name,
    schema: {
      layer: {
        type: "string",
        required: true,
      },
      path: {
        type: "text",
        required: true,
      },
      url: {
        type: "text",
        required: true,
      },
    },
    index: {
      layer_index: {
        action: "create",
        fields: ["layer"]
      }
    }
  };

  const new_group = await Resources.entities.create(entity);

  await Resources.entities.edit(new_group.id, {
    tags: [
      { key: "group_id", value: new_group.id },
      { key: "organization_id", value: entityParams.org_id },
      { key: "entity_type", value: "group" },
      { key: "group_address", value: entityParams.new_group_address || "N/A" },
    ],
  });

  return new_group.id;
}

/**
 * Retrieves and parses form fields from the provided data scope
 * @param scope - Array of EntityData objects containing form field information
 * @returns A promise that resolves to the parsed form fields
 * @throws {Error} If parsing fails
 */
async function getFormFields(scope: EntityData[]) {
  //Collecting data
  const name = scope.find((x) => x.new_group_name)?.new_group_name as string;
  const address = scope.find((x) => x.new_group_address)?.new_group_address as string;

  const result = await groupModel.parseAsync({
    name: name,
    address: address,
  });

  return result;
}

/**
 * Main function of creating groups
 * @param context Context is a variable sent by the analysis
 * @param scope Number of devices that will be listed
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function groupAdd({ context, scope, environment }: RouterConstructorEntity) {
  if (!environment || !scope || !context) {
    throw new Error("Missing parameters");
  }

  const config_id = environment.config_id;
  if (!config_id) {
    throw "[Error] No config device ID: config_id.";
  }

  const validate = initializeValidation("group_validation", config_id);
  await validate("#VAL.REGISTERING#", "warning").catch((error) => console.error(error));

  const organizationGroudId = scope[0].entity;
  const organizationGroup = await Resources.entities.info(organizationGroudId);
  if (!organizationGroup) {
    const error = "[Error] No organization group ID: organizationGroudId.";
    await validate(error, "danger").catch((error) => console.error(error));
    throw error;
  }

  const org_id = organizationGroup.tags.find((x) => x.key === "organization_id")?.value as string;

  const group_qty = await fetchEntityList({
    tags: [
      { key: "entity_type", value: "organization_group" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (group_qty.length >= 2) {
    const error = "Limit of 2 groups reached";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

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


  const is_group_name_exists = await entityNameExists({
    name: formFields.name,
    tags: [
      { key: "entity_type", value: "organization_group" },
      { key: "organization_id", value: org_id },
    ],
  });

  if (is_group_name_exists) {
    const error = "Group name already exists";
    await validate(error, "danger").catch((error) => console.error(error));
    throw new Error(error);
  }

  const new_group_id = await installEntity({ new_group_name: formFields.name, org_id, new_group_address: formFields.address });

  await sendGroupData(organizationGroudId, org_id, formFields, new_group_id).catch(async (error) => {
    await validate(error, "danger").catch((error) => console.error(error));
    throw error;
  });

  //uploading a default layer
  await uploadDefaultLayer(new_group_id);

  return validate("#VAL.GROUP_SUCCESSFULLY_CREATED#", "success");
}

export { groupAdd };
