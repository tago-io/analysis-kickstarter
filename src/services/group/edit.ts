import { Resources } from "@tago-io/sdk";
import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { sendNotificationFeedback } from "../../lib/send-notification";
import { undoEntityChanges } from "../../lib/undo-entity-changes";
import { RouterConstructorDevice } from "../../types";
import { EntityInfo } from "@tago-io/sdk/lib/modules/Resources/entities.types";
import { entityNameExists } from "../../lib/entity-name-exists";

async function editEntity(group_info: EntityInfo, new_group_name: string, new_group_address: string) {

  let tags = group_info.tags;
  if (new_group_address) {
    tags = tags.map(tag => tag.key === "group_address" ? { ...tag, value: new_group_address } : tag);
  }

  await Resources.entities.edit(group_info.id, {
    name: new_group_name,
    tags
  });
}

/**
 * Main function of editing groups
 * @param scope Scope is a variable sent by the analysis
 * @param environment Environment Variable is a resource to send variables values to the context of your script
 */
async function groupEdit({ scope, environment }: RouterConstructorDevice & { scope: DeviceListScope[] }) {
  if (!environment || !scope) {
    throw new Error("Missing parameters");
  }
  const orgGroup_id = scope[0].entity;
  const dataId = scope[0].id;

  const [orgGroupData] = await Resources.entities.getEntityData(orgGroup_id, {
    filter: {
      id: dataId,
    },
    amount: 1,
    index: "id_idx",
  });

  if (!orgGroupData) {
    throw new Error("Organization group not found");
  }

  const group_id = orgGroupData.group_id;

  const new_group_name = scope[0].group_name;
  const new_group_address = scope[0].group_address;
  const group_info = await Resources.entities.info(group_id);
  const org_id = group_info.tags.find((x) => x.key === "organization_id")?.value as string;

  if (new_group_name) {
    const is_group_name_exists = await entityNameExists({
      name: new_group_name,
      tags: [
        { key: "device_type", value: "group" },
        { key: "organization_id", value: org_id },
      ],
      isEdit: true,
    });

    if (is_group_name_exists) {
      await undoEntityChanges({ entityInfo: group_info, scope });
      await sendNotificationFeedback({ environment, message: `The organization with name ${new_group_name} already exists.` });
      throw `The organization with name ${new_group_name} already exists.`;
    }
  }

  await editEntity(group_info, new_group_name, new_group_address);

  return console.debug("Group edited!");
}

export { groupEdit };
