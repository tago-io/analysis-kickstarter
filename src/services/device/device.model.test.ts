import { describe, it, expect } from "vitest";
import { deviceModel, IDevice } from "./device.model";

describe("Device Model", () => {
  describe("Valid cases", () => {
    it("should validate a device with all required fields", () => {
      const validDevice = {
        name: "Test Device",
        group: "group-123",
        type: "sensor",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(validDevice);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validDevice);
      }
    });

    it("should validate a device with all fields including optional eui", () => {
      const validDevice = {
        name: "Test Device",
        eui: "00-11-22-33-44-55-66-77",
        group: "group-123",
        type: "sensor",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(validDevice);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validDevice);
      }
    });
  });

  describe("Invalid cases", () => {
    it("should reject a device without a name", () => {
      const invalidDevice = {
        group: "group-123",
        type: "sensor",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Name is required");
      }
    });

    it("should reject a device with a name shorter than 3 characters", () => {
      const invalidDevice = {
        name: "Te",
        group: "group-123",
        type: "sensor",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Name is smaller than 3 characters");
      }
    });

    it("should reject a device without required group field", () => {
      const invalidDevice = {
        name: "Test Device",
        type: "sensor",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
    });

    it("should reject a device without required type field", () => {
      const invalidDevice = {
        name: "Test Device",
        group: "group-123",
        network: "lorawan",
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
    });

    it("should reject a device without required network field", () => {
      const invalidDevice = {
        name: "Test Device",
        group: "group-123",
        type: "sensor",
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
    });

    it("should reject a device with invalid field types", () => {
      const invalidDevice = {
        name: 123, // number instead of string
        eui: 456, // number instead of string
        group: 789, // number instead of string
        type: 101, // number instead of string
        network: 112, // number instead of string
      };

      const result = deviceModel.safeParse(invalidDevice);
      expect(result.success).toBe(false);
    });
  });

  describe("Type checking", () => {
    it("should have correct TypeScript type inference", () => {
      const device: IDevice = {
        name: "Test Device",
        eui: "00-11-22-33-44-55-66-77",
        group: "group-123",
        type: "sensor",
        network: "lorawan",
      };

      // This test will fail at compile time if the type is incorrect
      expect(device).toBeDefined();
    });
  });
});
