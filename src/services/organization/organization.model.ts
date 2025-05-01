import { z } from "zod";

const organizationModel = z
  .object({
    name: z.string({ required_error: "Name is required" }).min(3, { message: "Name must be at least 3 characters" }).max(40, { message: "Name must be less than 40 characters" }),
    address: z.string().optional(),
    plan: z.string({ required_error: "Plan error, internal problem." }),
  });

type IOrganizationModel = z.infer<typeof organizationModel>;

export { IOrganizationModel, organizationModel };
