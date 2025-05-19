import { z } from "zod";

const zUserAccess = z.enum(["orgadmin", "guest", "admin"]);

const userModel = z.object({
  name: z.string({ required_error: "Name is required" }).min(3).max(100),
  email: z.string({ required_error: "Email is required" }).email(),
  phone: z.string().optional(),
  access: zUserAccess,
});

type IUser = z.infer<typeof userModel>;

export { IUser, userModel };