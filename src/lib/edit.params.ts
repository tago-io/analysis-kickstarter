import { Resources } from "@tago-io/sdk";
import { ConfigurationParams } from "@tago-io/sdk/lib/types";

/**
 * Creates a resolver to add/update configuration params on the devices.
 * It automatically identifies if the data already exists or not.
 * @example
 * const paramList = await Resources.devices.list(deviceID);
 * const editParam = ParamResolver(paramList);
 * editParam.setParam("device_status", "ON");
 * await editParam.apply(account, deviceID);
 *
 * @param {ConfigurationParams[]} rawParams param list if you already have in your code.
 * @param debug
 * @returns
 */
function ParamResolver(rawParams: ConfigurationParams[], debug: boolean = false) {
  const paramList: ConfigurationParams[] = [];

  const paramResolver = {
    /**
     * Set the configuration parameter for your Device
     * @param {string} key key of the Tag
     * @param {string} value value of the Tag
     * @param {string} [sent] optional sent value
     * @returns
     */
    setParam: function (key: string, value: string, sent: boolean = true) {
      if (typeof key !== "string") {
        throw "[ParamResolver] key is not a string";
      }
      if (typeof value !== "string") {
        throw "[ParamResolver] key is not a string";
      }
      const oldParam = rawParams.find((x) => x.key === key);
      paramList.push({ ...oldParam, key, value, sent });
      return this;
    },

    /**
     * Apply the changes to the configuration parameters.
     * @param {string} deviceID Device ID to apply the changes
     * @returns
     */
    apply: async function (deviceID: string) {
      if (debug) {
        return paramList;
      }
      await Resources.devices.paramSet(deviceID, paramList);
    },

    /**
     * Check if there is any change to be applied.
     * @returns {boolean} true if there is any change to be applied.
     */
    hasChanged: function () {
      return paramList.length > 0;
    },
  };

  return paramResolver;
}

export { ParamResolver };
