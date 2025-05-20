import { describe, it, expect } from "vitest";
import { groupModel, IGroup } from "./group.model";

describe("Group Model", () => {
  describe("Valid cases", () => {
    it("should validate a group with required fields", () => {
      const validGroup = {
        name: "Test Group",
      };

      const result = groupModel.safeParse(validGroup);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validGroup);
      }
    });

    it("should validate a group with all fields", () => {
      const validGroup = {
        name: "Test Group",
        address: "123 Test Street",
      };

      const result = groupModel.safeParse(validGroup);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validGroup);
      }
    });
  });

  describe("Invalid cases", () => {
    it("should reject a group without a name", () => {
      const invalidGroup = {};

      const result = groupModel.safeParse(invalidGroup);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Name is required");
      }
    });

    it("should reject a group with a name shorter than 3 characters", () => {
      const invalidGroup = {
        name: "Te",
      };

      const result = groupModel.safeParse(invalidGroup);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Name is smaller than 3 characters");
      }
    });

    it("should reject a group with invalid field types", () => {
      const invalidGroup = {
        name: 123, // number instead of string
        address: 456, // number instead of string
      };

      const result = groupModel.safeParse(invalidGroup);
      expect(result.success).toBe(false);
    });
  });

  describe("Type checking", () => {
    it("should have correct TypeScript type inference", () => {
      const group: IGroup = {
        name: "Test Group",
        address: "123 Test Street",
      };

      // This test will fail at compile time if the type is incorrect
      expect(group).toBeDefined();
    });
  });
});
