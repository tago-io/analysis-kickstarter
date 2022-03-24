import { DataToSend } from "@tago-io/sdk/out/modules/Device/device.types";
// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file is all logics of parseit (example script).
// ? ====================================================================================

interface GenericBody {
  [index: string]: any;
}

function parseTagoObject(body: GenericBody, group?: string): DataToSend[] {
  if (!group) {
    group = String(new Date().getTime());
  }
  return Object.keys(body)
    .map((item) => {
      return {
        variable: item,
        value: body[item] instanceof Object ? body[item].value : body[item],
        group,
        time: body[item] instanceof Object ? body[item].time : null,
        location: body[item] instanceof Object ? body[item].location : null,
        metadata: body[item] instanceof Object ? body[item].metadata : null,
      };
    })
    .filter((item) => item.value !== null && item.value !== undefined);
}

export { parseTagoObject };
