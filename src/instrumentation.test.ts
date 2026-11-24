// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/** Imports a fresh copy of `register` so the server config cache starts empty. */
async function loadRegister() {
  vi.resetModules();
  return (await import("./instrumentation")).register;
}

/** Stubs `process.exit` (so the test runner survives) and silences the startup log. */
function stubExit() {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  return { exit, consoleError };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register", () => {
  it("validates the server config in the Node.js runtime", async () => {
    const { exit } = stubExit();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://ok.example");
    const register = await loadRegister();
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
    // The validated config is cached by the same module instance the app uses.
    const { getServerConfig } = await import("@/lib/config/server");
    expect(getServerConfig().CORS_ALLOWED_ORIGINS).toEqual(["https://ok.example"]);
  });

  it("logs the invalid variables and exits with code 1 in production", async () => {
    const { exit, consoleError } = stubExit();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://bad.example/");
    const register = await loadRegister();
    await expect(register()).rejects.toThrow(/Invalid server environment variables/);
    expect(exit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid configuration"),
      expect.objectContaining({ message: expect.stringContaining("CORS_ALLOWED_ORIGINS") }),
    );
  });

  it("logs the invalid variables without exiting or throwing in development", async () => {
    const { exit, consoleError } = stubExit();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://bad.example/");
    const register = await loadRegister();
    // `next dev` exits on any error thrown from register(), so development must not throw.
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Invalid configuration"),
      expect.objectContaining({ message: expect.stringContaining("CORS_ALLOWED_ORIGINS") }),
    );
    // The failure is not cached: requests that read the config still get the error.
    const { getServerConfig } = await import("@/lib/config/server");
    expect(() => getServerConfig()).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it.each(["edge", "", undefined])(
    "does nothing when NEXT_RUNTIME is %j, even with an invalid environment",
    async (runtime) => {
      const { exit } = stubExit();
      vi.stubEnv("NEXT_RUNTIME", runtime);
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://bad.example/");
      const register = await loadRegister();
      await expect(register()).resolves.toBeUndefined();
      expect(exit).not.toHaveBeenCalled();
    },
  );
});
