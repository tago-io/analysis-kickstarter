import { Resources } from "@tago-io/sdk";
import { TagsObj } from "@tago-io/sdk/lib/types";

/**
 * Creates a resolver to add/update tags on the devices.
 * It automatically identifies if the tag already exists or not.
 * @example
 * const { tags } = await Resources.devices.info(deviceID);
 * const editTags = TagResolver(tags);
 * editTags.setTag("device_status", "ON");
 * await editTags.apply(deviceID);
 *
 * @param {TagsObj[]} rawTags list of your device existing Tags
 * @param debug
 * @returns
 */
function TagResolver(rawTags: TagsObj[], debug: boolean = false) {
  const tags = JSON.parse(JSON.stringify(rawTags)) as TagsObj[];
  const newTags: TagsObj[] = [];

  const tagResolver = {
    /**
     * Set the Tag for your Device
     * @param {string} key key of the Tag
     * @param {string} value value of the Tag
     * @returns
     */
    setTag: function (key: string, value: string) {
      if (typeof key !== "string") {
        throw "[TagResolver] key is not a string";
      }
      if (typeof value !== "string") {
        throw "[TagResolver] key is not a string";
      }
      const tagExist = tags.find((x) => x.key === key);
      if (!tagExist || tagExist.value !== value) {
        newTags.push({ key, value });
      }
      return this;
    },

    /**
     * Apply the changes to the tags
     * @param {string} deviceID Device ID to apply the changes
     * @returns
     */
    apply: async function (deviceID: string) {
      if (debug) {
        return newTags;
      }
      // merge tags and newTags, replacing the old tags with the new ones.
      for (const newTag of newTags) {
        const oldTagIndex = tags.findIndex((x) => x.key === newTag.key);
        if (oldTagIndex >= 0) {
          tags[oldTagIndex] = newTag;
        } else {
          tags.push(newTag);
        }
      }

      await Resources.devices.edit(deviceID, { tags });
    },

    /**
     * Check if there is any change to be applied.
     * @returns {boolean} true if there is any change to be applied.
     * @memberof TagResolver
     */
    hasChanged: function () {
      return newTags.length > 0;
    },
  };

  return tagResolver;
}

export { TagResolver };
