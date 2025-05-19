import { TagsObj } from "@tago-io/sdk/lib/types";
import { fetchEntityList } from "./fetch-entity-list";

interface EntitySource {
  name: string;
  tags: TagsObj[];
  isEdit?: boolean;
}

/**
 * The Entity Creation and Edit utilize this method.
 * @description Check if entity name exists
 * @param {string} name Entity name
 * @param {TagsObj[]} tags Entity tags
 * @param {boolean} isEdit When editing a entity, if a entity with the same name already exists, it should return two entities.
 * This is because the frontend automatically handles the editing process.
 */
async function entityNameExists({ name, tags, isEdit = false }: EntitySource) {
  const entity = await fetchEntityList({
    name,
    tags,
  });

  if (isEdit && entity.length > 1) {
    return true;
  } else if (!isEdit && entity.length > 0) {
    return true;
  }

  return false;
}

export { entityNameExists };
