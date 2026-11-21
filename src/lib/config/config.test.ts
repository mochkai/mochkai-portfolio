import { afterEach, describe, expect, it, vi } from "vitest";
import { parseServerConfig } from "./server";

describe("parseServerConfig", () => {
  it("applies defaults for an empty environment", () => {
    expect(parseServerConfig({})).toEqual({
      NODE_ENV: "development",
      DATA_SOURCE: "json",
      CORS_ALLOWED_ORIGINS: [],
    });
  });

  it("treats empty strings as unset", () => {
    const config = parseServerConfig({
      NODE_ENV: "",
      DATA_SOURCE: "",
      CORS_ALLOWED_ORIGINS: "",
      CONTENT_API_URL: "",
      CONTENT_API_TOKEN: "",
    });
    expect(config).toEqual({
      NODE_ENV: "development",
      DATA_SOURCE: "json",
      CORS_ALLOWED_ORIGINS: [],
    });
  });

  it("ignores undefined values and unrelated variables", () => {
    const config = parseServerConfig({ DATA_SOURCE: undefined, PATH: "/usr/bin", HOME: "/root" });
    expect(config).not.toHaveProperty("PATH");
    expect(config.DATA_SOURCE).toBe("json");
  });

  it("splits, trims and drops empty CORS origins", () => {
    const config = parseServerConfig({
      CORS_ALLOWED_ORIGINS: " https://a.example , ,https://b.example,, ",
    });
    expect(config.CORS_ALLOWED_ORIGINS).toEqual(["https://a.example", "https://b.example"]);
  });

  it("keeps a wildcard origin", () => {
    expect(parseServerConfig({ CORS_ALLOWED_ORIGINS: "*" }).CORS_ALLOWED_ORIGINS).toEqual(["*"]);
  });

  it("reads valid explicit values", () => {
    const config = parseServerConfig({
      NODE_ENV: "production",
      DATA_SOURCE: "json",
      CONTENT_API_URL: "https://cms.example.com/api",
      CONTENT_API_TOKEN: "secret",
    });
    expect(config).toMatchObject({
      NODE_ENV: "production",
      CONTENT_API_URL: "https://cms.example.com/api",
      CONTENT_API_TOKEN: "secret",
    });
  });

  it.each([
    ["DATA_SOURCE", "cms"],
    ["NODE_ENV", "staging"],
    ["CONTENT_API_URL", "not-a-url"],
  ])("throws a readable error naming %s=%s", (key, value) => {
    expect(() => parseServerConfig({ [key]: value })).toThrow(
      new RegExp(`Invalid server environment variables[\\s\\S]*${key}`),
    );
  });

  it("lists every invalid variable in one error", () => {
    let message = "";
    try {
      parseServerConfig({ DATA_SOURCE: "cms", CONTENT_API_URL: "nope" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATA_SOURCE");
    expect(message).toContain("CONTENT_API_URL");
  });
});

describe("getServerConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses process.env once and caches the result", async () => {
    vi.resetModules();
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://first.example");
    const { getServerConfig: fresh } = await import("./server");
    const first = fresh();
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://second.example");
    expect(fresh()).toBe(first);
    expect(fresh().CORS_ALLOWED_ORIGINS).toEqual(["https://first.example"]);
  });
});

describe("publicConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Imports a fresh copy of the public config module so it re-reads `process.env`. */
  async function loadPublicConfig() {
    vi.resetModules();
    return (await import("./public")).publicConfig;
  }

  it("defaults the site URL and leaves the chatbot URL unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_CHATBOT_URL", undefined);
    expect(await loadPublicConfig()).toEqual({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
  });

  it("treats empty strings as unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CHATBOT_URL", "");
    const config = await loadPublicConfig();
    expect(config.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(config.NEXT_PUBLIC_CHATBOT_URL).toBeUndefined();
  });

  it("reads valid values", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://me.example.com");
    vi.stubEnv("NEXT_PUBLIC_CHATBOT_URL", "https://chat.example.com");
    expect(await loadPublicConfig()).toEqual({
      NEXT_PUBLIC_SITE_URL: "https://me.example.com",
      NEXT_PUBLIC_CHATBOT_URL: "https://chat.example.com",
    });
  });

  it("throws on an invalid URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    await expect(loadPublicConfig()).rejects.toThrow();
  });
});
