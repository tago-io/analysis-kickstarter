import { Device } from "@tago-io/sdk";

/**
 * Setup function to send validation data to widgets.
 *
 * @returns a new function to be used to send the actual validation message.
 * @param validation_var variable of the validation in the widget
 * @param device device associated to the variable in the widget
 * @param show_markdown enable/disable markdown
 */
type validation_type = "success" | "danger" | "warning" | string;

export default function validation(validation_var: string, device: Device, show_markdown?: boolean) {
  return function _(message: string, type: validation_type) {
    if (!message || !type) {
      throw "Missing message or type";
    }
    device.sendData({
      variable: validation_var,
      value: message,
      metadata: {
        type: ["success", "danger", "warning"].includes(type) ? type : null,
        color: !["success", "danger", "warning"].includes(type) ? type : null,
        show_markdown,
      },
    });

    return message;
  };
}
