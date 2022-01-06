import { RouterConstructor } from "@tago-io/sdk/out/modules/Utils/router/router";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructor) => {
  //id of the org device
  const org_id = (scope[0] as any).device;

  const params = await account.devices.paramList(org_id);

  const org_auth_token = params.find((x) => x.key === "org_auth_token");
  //deleting token
  // const [org_auth_token] = await config_dev.getData({ variables: "org_auth_token", qty: 1, series: org_id });
  if (org_auth_token?.value) {
    await account.ServiceAuthorization.tokenDelete(org_auth_token.value as string);
  }

  //delete from settings_device
  await config_dev.deleteData({ series: org_id, qty: 99999 });

  //deleting users (organization's user)
  const user_accounts = await account.run.listUsers({ filter: { tags: [{ key: "organization_id", value: org_id }] } });
  if (user_accounts) {
    user_accounts.forEach((user) => account.run.userDelete(user.id));
  }

  //deleting organization's device
  const devices = await account.devices.list({
    amount: 9999,
    page: 1,
    filter: { tags: [{ key: "organization_id", value: org_id }] },
    fields: ["id", "bucket", "tags", "name"],
  });

  if (devices) {
    devices.forEach((x) => {
      account.devices.delete(x.id); /*passing the device id*/
      account.buckets.delete(x.bucket); /*passing the bucket id*/
    });
  }

  return;
};
