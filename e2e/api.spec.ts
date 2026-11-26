import { expect, test } from "@playwright/test";
import projectsData from "../src/data/projects.json";

// Browser-free API checks: these use only the `request` fixture (APIRequestContext).

test.describe("API", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("GET /api/profile returns a profile", async ({ request }) => {
    const res = await request.get("/api/profile");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);
    const body = await res.json();
    expect(typeof body.name).toBe("string");
    expect(Array.isArray(body.socials)).toBe(true);
  });

  test("GET /api/projects returns projects without any dates", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect(res.status()).toBe(200);
    const text = await res.text();
    const body: Record<string, unknown>[] = JSON.parse(text);
    expect(body.length).toBeGreaterThan(0);
    // DESIGN.md "Content and privacy": project dates are redacted from the API (#7).
    for (const project of body) {
      expect(project).not.toHaveProperty("startDate");
      expect(project).not.toHaveProperty("endDate");
      expect(["complete", "active"]).toContain(project.status);
    }
    expect(text).not.toMatch(/\b(19|20)\d{2}-\d{2}\b/);
  });

  test("GET /api/projects keeps the newest-first order of projects.json", async ({ request }) => {
    const body: { slug: string }[] = await (await request.get("/api/projects")).json();
    // The API no longer exposes dates, so the expected order comes from the content data.
    const expected = [...projectsData]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((p) => p.slug);
    expect(body.map((p) => p.slug)).toEqual(expected);
  });

  test("GET /api/projects?featured=true|false filters", async ({ request }) => {
    const all: unknown[] = await (await request.get("/api/projects")).json();
    const featured: { featured: boolean }[] = await (
      await request.get("/api/projects?featured=true")
    ).json();
    const other: { featured: boolean }[] = await (
      await request.get("/api/projects?featured=false")
    ).json();
    expect(featured.every((p) => p.featured)).toBe(true);
    expect(other.every((p) => !p.featured)).toBe(true);
    expect(featured.length + other.length).toBe(all.length);
  });

  test("GET /api/projects?featured=yes returns 400 JSON", async ({ request }) => {
    const res = await request.get("/api/projects?featured=yes");
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({
      error: "Query parameter 'featured' must be 'true' or 'false'",
    });
  });

  test("GET /api/projects/:slug returns one project", async ({ request }) => {
    const [first]: { slug: string }[] = await (await request.get("/api/projects")).json();
    const res = await request.get(`/api/projects/${first.slug}`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.slug).toBe(first.slug);
    expect(body).not.toHaveProperty("startDate");
    expect(body).not.toHaveProperty("endDate");
    expect(text).not.toMatch(/\b(19|20)\d{2}-\d{2}\b/);
  });

  test("GET /api/projects/:slug returns 404 JSON for an unknown slug", async ({ request }) => {
    const res = await request.get("/api/projects/does-not-exist");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "Project not found" });
  });

  test("GET /api/experience returns entries", async ({ request }) => {
    const res = await request.get("/api/experience");
    expect(res.status()).toBe(200);
    const body: { id: string }[] = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  test("GET /api/experience returns no dates (DATED_COMPANY_LIMIT is 0)", async ({ request }) => {
    const res = await request.get("/api/experience");
    const text = await res.text();
    const body: Record<string, unknown>[] = JSON.parse(text);
    for (const entry of body) {
      expect(entry).not.toHaveProperty("startDate");
      expect(entry).not.toHaveProperty("endDate");
      expect(typeof entry.current).toBe("boolean");
    }
    expect(text).not.toMatch(/\b(19|20)\d{2}-\d{2}\b/);
  });

  test("cross-origin requests get no Allow-Origin with the default config", async ({ request }) => {
    // The E2E server is started without CORS_ALLOWED_ORIGINS, so no origin is allowed.
    const res = await request.get("/api/profile", {
      headers: { Origin: "https://chat.example.com" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers()["vary"]).toMatch(/Origin/i);
  });

  for (const path of ["/", "/projects/project-one", "/api/profile", "/api/health"]) {
    test(`${path} sends security headers and no X-Powered-By`, async ({ request }) => {
      const res = await request.get(path, { headers: { Origin: "https://chat.example.com" } });
      expect(res.status()).toBe(200);
      const headers = res.headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }

  test("security headers leave the API's CORS headers intact", async ({ request }) => {
    const res = await request.get("/api/profile", {
      headers: { Origin: "https://chat.example.com" },
    });
    expect(res.headers()["vary"]).toMatch(/Origin/i);
    expect(res.headers()["x-frame-options"]).toBe("DENY");
  });

  test("OPTIONS preflight answers 204", async ({ request }) => {
    const res = await request.fetch("/api/projects", {
      method: "OPTIONS",
      headers: { Origin: "https://chat.example.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.status()).toBe(204);
  });
});
