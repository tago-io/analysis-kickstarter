import { describe, it, expect } from "vitest";
import { userModel } from "./user.model";

describe("userModel", () => {
  const validUser = {
    name: "Alice",
    email: "alice@example.com",
    phone: "+1234567890",
    access: "orgadmin" as const,
  };

  it("should validate a correct user", () => {
    const result = userModel.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("should validate without phone (optional)", () => {
    const { phone, ...userNoPhone } = validUser;
    const result = userModel.safeParse(userNoPhone);
    expect(result.success).toBe(true);
  });

  it("should fail if name is empty", () => {
    const result = userModel.safeParse({ ...validUser, name: "" });
    expect(result.success).toBe(false);
  });

  it("should fail if name is too long", () => {
    const result = userModel.safeParse({ ...validUser, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should fail if email is invalid", () => {
    const result = userModel.safeParse({ ...validUser, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("should fail if access is not allowed", () => {
    const result = userModel.safeParse({ ...validUser, access: "admin" });
    expect(result.success).toBe(false);
  });

  it("should fail if required fields are missing", () => {
    const result = userModel.safeParse({});
    expect(result.success).toBe(false);
  });
});