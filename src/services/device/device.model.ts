import { z } from "zod";

const deviceModel = z.object({
  name: z.string({ required_error: "Name is required" }).min(3, { message: "Name is smaller than 3 characters" }),
  eui: z.string().optional(),
  group: z.string(),
  type: z.string(),
  network: z.string({ required_error: "Network is required" }),
});

type IDevice = z.infer<typeof deviceModel>;

export { IDevice, deviceModel };
