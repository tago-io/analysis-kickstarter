import { TagResolver } from "./edit.tag";

describe("LIB | edit.tag Resolver", () => {
  test("Success Resolver", async () => {
    const tagResolver = TagResolver([{ key: "test", value: "1" }], true);
    tagResolver.setTag("test2", "23423");
    tagResolver.setTag("test", "5555");
    const result = await tagResolver.apply("");

    expect(result).toStrictEqual([
      { key: "test2", value: "23423" },
      { key: "test", value: "5555" },
    ]);
  });

  test("Invalid Key Type", () => {
    const tagResolver = TagResolver([]);

    // @ts-expect-error we are testing an invalid key
    expect(() => tagResolver.setTag(1234, "test")).toThrow();
  });

  test("Invalid Value Type", () => {
    const tagResolver = TagResolver([]);

    // @ts-expect-error we are testing an invalid key
    expect(() => tagResolver.setTag("test", 1234)).toThrow();
  });
});
