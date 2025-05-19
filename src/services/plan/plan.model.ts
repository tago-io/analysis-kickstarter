import { z } from "zod";

const planModel = z
  .object({
    name: z.string({ required_error: "Name is required" }).min(3, { message: "Name must be at least 3 characters" }).max(40, { message: "Name must be less than 40 characters" }),
    email_usg_limit_qty_m: z.number({ required_error: "Email usage limit is required" }).min(0, { message: "Email usage limit must be greater than 0" }),
    sms_usg_limit_qty_m: z.number({ required_error: "SMS usage limit is required" }).min(0, { message: "SMS usage limit must be greater than 0" }),
    push_notification_usg_limit_qty_m: z.number({ required_error: "Push notification usage limit is required" }).min(0, { message: "Push notification usage limit must be greater than 0" }),
    data_retention_m: z.number({ required_error: "Data retention is required" }).min(0, { message: "Data retention must be greater than 0" }),
  });

const planModelEdit = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }).max(40, { message: "Name must be less than 40 characters" }).optional(),
  email_usg_limit_qty_m: z.number().min(0, { message: "Email usage limit must be greater than 0" }).optional(),
  sms_usg_limit_qty_m: z.number().min(0, { message: "SMS usage limit must be greater than 0" }).optional(),
  push_notification_usg_limit_qty_m: z.number().min(0, { message: "Push notification usage limit must be greater than 0" }).optional(),
  data_retention_m: z.number().min(0, { message: "Data retention must be greater than 0" }).optional(),
});

type IPlanModel = z.infer<typeof planModel>;
type IPlanModelEdit = z.infer<typeof planModelEdit>;

export { IPlanModel, IPlanModelEdit, planModel, planModelEdit };
