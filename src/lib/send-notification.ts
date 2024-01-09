import { Resources, Services } from "@tago-io/sdk";

interface INotificationError {
  environment: { [key: string]: string } | string;
  title?: string;
  message: string;
}

async function sendNotificationToDeveloper({ title, message }: Omit<INotificationError, "environment">) {
  const services = new Services({ token: process.env.T_ANALYSIS_TOKEN });
  await services.notification.send({
    title: title || "Operation error",
    message,
  });
}

/**
 * Get the tago device class from the device id
 * Requires RUN User Permissions and Notification Permission
 */
async function sendNotificationFeedback({ environment, title, message }: INotificationError) {
  let user_id: string;
  if (typeof environment === "string") {
    user_id = environment;
  } else {
    user_id = environment?._user_id;
  }
  if (!user_id) {
    await sendNotificationToDeveloper({ title, message });
    return;
  }

  const user = await Resources.run.userInfo(user_id).catch(() => null);
  if (!user) {
    await sendNotificationToDeveloper({ title, message });
    return;
  }

  await Resources.run.notificationCreate(user_id, {
    title: title || "Operation error",
    message,
  });
}

export { sendNotificationFeedback };
