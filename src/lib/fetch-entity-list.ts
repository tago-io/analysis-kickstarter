import { Resources } from "@tago-io/sdk";
import { EntityListItem, EntityQuery } from "@tago-io/sdk/lib/modules/Resources/entities.types";

type FetchEntityResponse = Pick<EntityListItem, "id" | "name" | "tags" | "created_at">;
/**
 * Fetchs the entity list using filters.
 * Automatically apply pagination to not run on throughtput errors.
 * @param filter filter conditions of the request
 * @returns
 */
async function fetchEntityList(filter: EntityQuery["filter"]): Promise<FetchEntityResponse[]> {
  let entity_list: FetchEntityResponse[] = [];

  for (let index = 1; index < 9999; index++) {
    const amount = 100;
    const foundEntities = await Resources.entities.list({
      page: index,
      fields: ["id", "name", "tags", "created_at"],
      filter,
      amount,
    });

    entity_list = entity_list.concat(foundEntities);
    if (foundEntities.length < amount) {
      return entity_list;
    }
  }

  return entity_list;
}

export { fetchEntityList, FetchEntityResponse };
