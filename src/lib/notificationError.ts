import { Account } from "@tago-io/sdk";

/**
 * Get the tago device class from the device id
 */
async function sendNotificationError(account: Account, environment: { [key: string]: string } | string, errorMessage: string, title?: string) {
  let user_id: string;
  if (typeof environment === "string") {
    user_id = environment as string;
  } else {
    user_id = environment?._user_id;
  }

  if (!user_id) {
    return;
  }

  const user = await account.run.userInfo(user_id).catch(() => null);
  if (!user_id) {
    return;
  }

  account.run
    .notificationCreate(user_id, {
      title: title || "Operation Error",
      message: errorMessage,
    })
    .catch((e) => console.log(`Notification Error: ${e}`));
}

export default sendNotificationError;
