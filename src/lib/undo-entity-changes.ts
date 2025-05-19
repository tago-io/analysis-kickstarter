import { DeviceListScope } from "@tago-io/sdk/lib/modules/Utils/router/router.types";
import { TagResolver } from "./edit.tag";
import { Resources } from "@tago-io/sdk";
import { EntityInfo } from "@tago-io/sdk/lib/modules/Resources/entities.types";

/**
 * Reverts changes made to a site's device list and tags.
 *
 * @param {Object} params - The parameters for the function.
 * @param {DeviceListScope[]} params.scope - The scope of the device list changes, scoped to a single device.
 * @param {EntityInfo} params.entityInfo - Information about the site entity, including tags.
 *
 * @returns {Promise<void>} A promise that resolves when the changes have been undone.
 *
 * @remarks
 * This function reverts changes made to the name and tags of a device within a site.
 * It uses the `TagResolver` to manage tag changes and applies them if any changes are detected.
 */
async function undoEntityChanges({ scope, entityInfo }: { scope: DeviceListScope[]; entityInfo: EntityInfo }) {
  const tagResolver = TagResolver(entityInfo.tags);

  // Entity editions are always scoped to a single entity.
  const entityScope = scope[0];

  for (const key of Object.keys(entityScope)) {
    if (key === "name") {
      const old_name = entityScope?.old?.[key] as string;
      await Resources.entities.edit(entityInfo.id, { name: old_name });
    } else if (key.includes("tags.")) {
      const tag_key = key.replace("tags.", "");
      const old_value = entityScope?.old?.[key] as string;
      tagResolver.setTag(tag_key, old_value);
    }
  }

  if (tagResolver.hasChanged()) {
    await tagResolver.apply(entityInfo.id);
  }
}

export { undoEntityChanges };