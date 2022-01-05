import { RouterConstructorData } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: RouterConstructorData) => {
  const plan_name = scope.find((x) => x.variable === "plan_data");

  const org_dev_list = await account.devices.list({
    page: 1,
    fields: ["id"],
    filter: {
      tags: [
        { key: "device_type", value: "organization" },
        { key: "plan_serie", value: plan_name.serie },
      ],
    },
    amount: 20,
    resolveBucketName: false,
  });

  if (org_dev_list.length > 0) {
    await config_dev.sendData(scope);
  }

  return console.log("Plan deleted");
};
