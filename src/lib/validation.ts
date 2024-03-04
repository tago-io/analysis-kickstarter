import { DateTime } from "luxon";

import { Resources } from "@tago-io/sdk";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type validation_type = "success" | "danger" | "warning" | string;
interface IValidateOptions {
  show_markdown?: boolean;
  user_id?: string;
}

/**
 * Setup function to send validation data to widgets.
 *
 * @returns a new function to be used to send the actual validation message.
 * @param validation_var variable of the validation in the widget
 * @param device device associated to the variable in the widget
 * @param show_markdown enable/disable markdown
 */
function initializeValidation(validationVariable: string, device_id: string, opts?: IValidateOptions) {
  let i = 0;
  return async function _(message: string, type: validation_type = "success") {
    if (!message || !type) {
      throw "Missing message or type";
    }

    i += 1;
    // clean validation old entries
    await Resources.devices
      .deleteDeviceData(device_id, {
        variables: validationVariable,
        qty: 999,
        end_date: DateTime.now().minus({ minutes: 1 }).toJSDate(),
      })
      .catch(console.log);

    // inser the new entry
    await Resources.devices
      .sendDeviceData(device_id, {
        variable: validationVariable,
        value: message,
        time: DateTime.now()
          .plus({ milliseconds: i * 200 })
          .toJSDate(), //increment time by i
        metadata: {
          type: ["success", "danger", "warning"].includes(type) ? type : null,
          color: !["success", "danger", "warning"].includes(type) ? type : undefined,
          show_markdown: !!opts?.show_markdown,
          user_id: opts?.user_id,
        },
      })
      .catch(console.error);

    return message;
  };
}

export { initializeValidation };
