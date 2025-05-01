import { describe, it, expect } from "vitest";
import { createURL } from "./url-creator";

describe("url-creator", () => {
  describe("createURL", () => {
    it("should create a URL with base only", () => {
      const url = createURL()
        .setBase("https://example.com")
        .build();

      expect(url).toBe("https://example.com");
    });

    it("should create a URL with one parameter", () => {
      const url = createURL()
        .setBase("https://example.com")
        .addParam("id", "123")
        .build();

      expect(url).toBe("https://example.com?id=123");
    });

    it("should create a URL with multiple parameters", () => {
      const url = createURL()
        .setBase("https://example.com")
        .addParam("id", "123")
        .addParam("name", "test")
        .addParam("type", "user")
        .build();

      expect(url).toBe("https://example.com?id=123&name=test&type=user");
    });

    it("should handle empty parameters", () => {
      const url = createURL()
        .setBase("https://example.com")
        .addParam("empty", "")
        .build();

      expect(url).toBe("https://example.com?empty=");
    });

    it("should handle special characters in parameters", () => {
      const url = createURL()
        .setBase("https://example.com")
        .addParam("query", "test&value")
        .addParam("space", "test value")
        .build();

      expect(url).toBe("https://example.com?query=test%26value&space=test+value");
    });

    it("should handle chaining methods", () => {
      const url = createURL()
        .setBase("https://example.com")
        .addParam("id", "123")
        .addParam("name", "test")
        .setBase("https://new-example.com")
        .addParam("type", "user")
        .build();

      expect(url).toBe("https://new-example.com?id=123&name=test&type=user");
    });

    it("should handle empty base URL", () => {
      const url = createURL()
        .addParam("id", "123")
        .build();

      expect(url).toBe("?id=123");
    });
  });
});
