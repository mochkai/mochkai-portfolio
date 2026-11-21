import { describe, expect, it } from "vitest";
import { resolveCorsHeaders } from "./cors";

const ALLOWED_FULL = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

describe("resolveCorsHeaders", () => {
  it("allows nothing by default", () => {
    expect(resolveCorsHeaders("https://chat.example.com", [])).toEqual({ Vary: "Origin" });
  });

  it("echoes an allowed origin", () => {
    const headers = resolveCorsHeaders("https://chat.example.com", ["https://chat.example.com"]);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://chat.example.com");
  });

  it("supports a wildcard", () => {
    expect(resolveCorsHeaders("https://any.example", ["*"])["Access-Control-Allow-Origin"]).toBe(
      "*",
    );
  });

  it("returns the full header set for an allowed origin", () => {
    expect(
      resolveCorsHeaders("https://a.example", ["https://b.example", "https://a.example"]),
    ).toEqual({
      Vary: "Origin",
      "Access-Control-Allow-Origin": "https://a.example",
      ...ALLOWED_FULL,
    });
  });

  it("returns only Vary when the request has no Origin, even with a wildcard", () => {
    expect(resolveCorsHeaders(null, ["*"])).toEqual({ Vary: "Origin" });
    expect(resolveCorsHeaders("", ["*"])).toEqual({ Vary: "Origin" });
  });

  it("rejects an origin that is not listed", () => {
    expect(resolveCorsHeaders("https://evil.example", ["https://chat.example.com"])).toEqual({
      Vary: "Origin",
    });
  });

  it("does not match on prefix, subdomain, scheme or port", () => {
    const allowed = ["https://chat.example.com"];
    for (const origin of [
      "https://chat.example.com.evil.example",
      "https://sub.chat.example.com",
      "http://chat.example.com",
      "https://chat.example.com:8443",
    ]) {
      expect(resolveCorsHeaders(origin, allowed)).not.toHaveProperty("Access-Control-Allow-Origin");
    }
  });

  it("answers '*' rather than echoing when the wildcard is mixed with explicit origins", () => {
    expect(
      resolveCorsHeaders("https://a.example", ["https://a.example", "*"])[
        "Access-Control-Allow-Origin"
      ],
    ).toBe("*");
  });

  it("allows the literal 'null' origin only under a wildcard", () => {
    expect(resolveCorsHeaders("null", [])).toEqual({ Vary: "Origin" });
    expect(resolveCorsHeaders("null", ["*"])["Access-Control-Allow-Origin"]).toBe("*");
  });
});
