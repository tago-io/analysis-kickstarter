import { ParamResolver } from "./edit.params";

describe("LIB | edit.params Resolver", () => {
  test("Success Resolver", async () => {
    const paramResolver = ParamResolver([{ key: "test", value: "1", sent: false, id: "1234" }], true);
    paramResolver.setParam("test2", "23423");
    paramResolver.setParam("test", "5555");
    const result = await paramResolver.apply("");

    expect(result).toStrictEqual([
      { key: "test2", value: "23423", sent: true },
      { key: "test", value: "5555", sent: true, id: "1234" },
    ]);
  });

  test("Invalid Key Type", () => {
    const paramResolver = ParamResolver([]);

    // @ts-expect-error we are testing an invalid key
    expect(() => paramResolver.setTag(1234, "test")).toThrow();
  });

  test("Invalid Value Type", () => {
    const paramResolver = ParamResolver([]);

    // @ts-expect-error we are testing an invalid key
    expect(() => paramResolver.setTag("test", 1234)).toThrow();
  });
});
