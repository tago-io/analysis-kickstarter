import { deviceNameExists } from "./device-name-exists";

jest.mock("../lib/fetch-device-list", () => {
  return {
    fetchDeviceList: jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([{ id: "orgOne" }]))
      .mockImplementationOnce(() => Promise.resolve([{ id: "orgOne" }, { id: "orgTwo" }])),
  };
});

describe("deviceNameExists", () => {
  test("should return false when device name does not exist", async () => {
    const result = await deviceNameExists({ name: "My Organization", tags: [{ key: "device_type", value: "organization" }] });
    expect(result).toBe(false);
  });

  test("should return true when device name exists and isEdit is false", async () => {
    const result = await deviceNameExists({ name: "My Organization", tags: [{ key: "device_type", value: "organization" }] });
    expect(result).toBe(true);
  });

  test("should return true when device name exists and isEdit is true with more than 1 matching device", async () => {
    const result = await deviceNameExists({ name: "My Organization", tags: [{ key: "device_type", value: "organization" }], isEdit: true });
    expect(result).toBe(true);
  });
});
