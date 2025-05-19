import { describe, it, expect } from "vitest";
import { planModelEdit, planModel } from "./plan.model";

describe("planModelEdit", () => {
  const validEdit = {
    name: "Pro Plan",
    email_usg_limit_qty_m: 100,
    sms_usg_limit_qty_m: 50,
    push_notification_usg_limit_qty_m: 200,
    data_retention_m: 12,
  };

  it("should validate a fully filled edit object", () => {
    const result = planModelEdit.safeParse(validEdit);
    expect(result.success).toBe(true);
  });

  it("should validate with only one field present", () => {
    const result = planModelEdit.safeParse({ name: "Pro Plan" });
    expect(result.success).toBe(true);
  });

  it("should fail if name is too short", () => {
    const result = planModelEdit.safeParse({ name: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name must be at least 3 characters");
    }
  });

  it("should fail if name is too long", () => {
    const result = planModelEdit.safeParse({ name: "a".repeat(41) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name must be less than 40 characters");
    }
  });

  it("should fail if a numeric field is negative", () => {
    const result = planModelEdit.safeParse({ email_usg_limit_qty_m: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/must be greater than 0/);
    }
  });

  it("should fail if a numeric field is not a number", () => {
    const result = planModelEdit.safeParse({ sms_usg_limit_qty_m: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("should validate if no fields are present (all optional)", () => {
    const result = planModelEdit.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("planModel (required fields)", () => {
  const validPlan = {
    name: "Pro Plan",
    email_usg_limit_qty_m: 100,
    sms_usg_limit_qty_m: 50,
    push_notification_usg_limit_qty_m: 200,
    data_retention_m: 12,
  };

  it("should validate a correct plan", () => {
    const result = planModel.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("should fail if a required field is missing", () => {
    const { name, ...rest } = validPlan;
    const result = planModel.safeParse(rest);
    expect(result.success).toBe(false);
  });
});