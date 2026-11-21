import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Loads a fresh copy of `@/lib/data` so its per-process caches start empty. */
async function loadDataModule() {
  vi.resetModules();
  return import("./index");
}

describe("getRepository", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a JsonRepository when DATA_SOURCE is unset", async () => {
    vi.stubEnv("DATA_SOURCE", undefined);
    const { getRepository } = await loadDataModule();
    const { JsonRepository } = await import("./json-repository");
    expect(getRepository()).toBeInstanceOf(JsonRepository);
  });

  it("returns a JsonRepository for DATA_SOURCE=json and for an empty DATA_SOURCE", async () => {
    vi.stubEnv("DATA_SOURCE", "json");
    let mod = await loadDataModule();
    expect(mod.getRepository().constructor.name).toBe("JsonRepository");

    vi.stubEnv("DATA_SOURCE", "");
    mod = await loadDataModule();
    expect(mod.getRepository().constructor.name).toBe("JsonRepository");
  });

  it("returns the same instance on every call", async () => {
    const { getRepository } = await loadDataModule();
    expect(getRepository()).toBe(getRepository());
  });

  it("throws a readable error for an unknown DATA_SOURCE", async () => {
    vi.stubEnv("DATA_SOURCE", "cms");
    const { getRepository } = await loadDataModule();
    expect(() => getRepository()).toThrow(/Invalid server environment variables[\s\S]*DATA_SOURCE/);
  });
});
