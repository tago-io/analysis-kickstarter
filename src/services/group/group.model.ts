import { z } from "zod";

const groupModel = z.object({
  name: z.string({ required_error: "Name is required" }).min(3, { message: "Name is smaller than 3 characters" }),
  address: z.string().optional(),
});

type IGroup = z.infer<typeof groupModel>;

export { IGroup, groupModel };