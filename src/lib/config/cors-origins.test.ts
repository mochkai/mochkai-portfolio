import { describe, expect, it } from "vitest";
import { isValidCorsOrigin, parseServerConfig } from "./server";

describe("CORS_ALLOWED_ORIGINS validation", () => {
  it.each(["*", "https://a.com", "http://localhost:4000", "http://127.0.0.1:8080"])(
    "accepts %s",
    (origin) => {
      expect(isValidCorsOrigin(origin)).toBe(true);
      expect(parseServerConfig({ CORS_ALLOWED_ORIGINS: origin }).CORS_ALLOWED_ORIGINS).toEqual([
        origin,
      ]);
    },
  );

  it.each([
    "https://a.com/",
    "https://a.com/path",
    "a.com",
    "https://A.com",
    "https://a.com:443",
    "https://a.com?x=1",
    "null",
    "*.a.com",
  ])("rejects %s with a message naming the entry", (origin) => {
    expect(isValidCorsOrigin(origin)).toBe(false);
    let message = "";
    try {
      parseServerConfig({ CORS_ALLOWED_ORIGINS: `https://ok.example,${origin}` });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(`Invalid origin ${JSON.stringify(origin)}`);
    expect(message).toContain("CORS_ALLOWED_ORIGINS[1]");
  });
});
