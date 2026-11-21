// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import experienceData from "@/data/experience.json";
import profileData from "@/data/profile.json";
import projectsData from "@/data/projects.json";

const BASE = "http://localhost:3000";
const ORIGIN = "https://chat.example.com";

/** The route modules, freshly imported so config and repository caches start empty. */
async function loadRoutes() {
  vi.resetModules();
  return {
    health: await import("@/app/api/health/route"),
    profile: await import("@/app/api/profile/route"),
    projects: await import("@/app/api/projects/route"),
    project: await import("@/app/api/projects/[slug]/route"),
    experience: await import("@/app/api/experience/route"),
  };
}

/** Builds a NextRequest for `path`, optionally from a cross-origin `origin`. */
function req(path: string, { origin, method = "GET" }: { origin?: string; method?: string } = {}) {
  return new NextRequest(new URL(path, BASE), {
    method,
    headers: origin ? { origin } : {},
  });
}

/** Route context for the `[slug]` handler. */
function slugCtx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

const sortedSlugs = [...projectsData]
  .sort((a, b) => b.startDate.localeCompare(a.startDate))
  .map((p) => p.slug);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("returns 200 { status: ok }", async () => {
    const { health } = await loadRoutes();
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/profile", () => {
  it("returns the profile as JSON", async () => {
    const { profile } = await loadRoutes();
    const res = await profile.GET(req("/api/profile"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual(profileData);
  });
});

describe("GET /api/experience", () => {
  it("returns experience most recent first", async () => {
    const { experience } = await loadRoutes();
    const res = await experience.GET(req("/api/experience"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; startDate: string }[];
    expect(body).toHaveLength(experienceData.length);
    const starts = body.map((e) => e.startDate);
    expect(starts).toEqual([...starts].sort().reverse());
  });
});

describe("GET /api/projects", () => {
  it("returns every project newest first", async () => {
    const { projects } = await loadRoutes();
    const res = await projects.GET(req("/api/projects"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string }[];
    expect(body.map((p) => p.slug)).toEqual(sortedSlugs);
  });

  it("filters with featured=true and featured=false", async () => {
    const { projects } = await loadRoutes();
    const featured = (await (await projects.GET(req("/api/projects?featured=true"))).json()) as {
      featured: boolean;
    }[];
    const other = (await (await projects.GET(req("/api/projects?featured=false"))).json()) as {
      featured: boolean;
    }[];
    expect(featured.length).toBe(projectsData.filter((p) => p.featured).length);
    expect(featured.every((p) => p.featured)).toBe(true);
    expect(other.length).toBe(projectsData.filter((p) => !p.featured).length);
    expect(other.every((p) => !p.featured)).toBe(true);
  });

  it.each(["yes", "1", "TRUE", "", "true,false"])(
    "returns 400 JSON for featured=%j",
    async (value) => {
      const { projects } = await loadRoutes();
      const res = await projects.GET(req(`/api/projects?featured=${encodeURIComponent(value)}`));
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(await res.json()).toEqual({
        error: "Query parameter 'featured' must be 'true' or 'false'",
      });
    },
  );

  it("ignores unrelated query parameters", async () => {
    const { projects } = await loadRoutes();
    const res = await projects.GET(req("/api/projects?page=2"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/projects/[slug]", () => {
  it("returns the matching project", async () => {
    const { project } = await loadRoutes();
    const slug = projectsData[0].slug;
    const res = await project.GET(req(`/api/projects/${slug}`), slugCtx(slug));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(projectsData[0]);
  });

  it("returns 404 JSON for an unknown slug", async () => {
    const { project } = await loadRoutes();
    const res = await project.GET(req("/api/projects/nope"), slugCtx("nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "Project not found" });
  });
});

describe("GET /api/projects/[slug] input validation", () => {
  it.each(["Project-One", "../etc/passwd", "<script>", "a b", "a--b", ""])(
    "returns 404 without echoing the malformed slug %j",
    async (slug) => {
      const { project } = await loadRoutes();
      const res = await project.GET(req("/api/projects/x"), slugCtx(slug));
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body).toEqual({ error: "Project not found" });
    },
  );

  it("does not query the repository for a malformed slug", async () => {
    vi.resetModules();
    const getProjectBySlug = vi.fn();
    vi.doMock("@/lib/data", () => ({ getRepository: () => ({ getProjectBySlug }) }));
    const { GET } = await import("@/app/api/projects/[slug]/route");
    const res = await GET(req("/api/projects/x"), slugCtx("../secret"));
    expect(res.status).toBe(404);
    expect(getProjectBySlug).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/data");
  });
});

describe("CORS", () => {
  it("sends only Vary: Origin when CORS_ALLOWED_ORIGINS is unset", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    const { profile, projects } = await loadRoutes();
    for (const res of [
      await profile.GET(req("/api/profile", { origin: ORIGIN })),
      await projects.GET(req("/api/projects", { origin: ORIGIN })),
    ]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("vary")).toBe("Origin");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("echoes an allowed origin on every data route, including errors", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", `https://other.example, ${ORIGIN}`);
    const { profile, projects, project, experience } = await loadRoutes();
    const responses = [
      await profile.GET(req("/api/profile", { origin: ORIGIN })),
      await experience.GET(req("/api/experience", { origin: ORIGIN })),
      await projects.GET(req("/api/projects", { origin: ORIGIN })),
      await projects.GET(req("/api/projects?featured=maybe", { origin: ORIGIN })),
      await project.GET(req("/api/projects/nope", { origin: ORIGIN }), slugCtx("nope")),
    ];
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 400, 404]);
    for (const res of responses) {
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      expect(res.headers.get("vary")).toBe("Origin");
    }
  });

  it("does not allow an origin that is not listed", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", ORIGIN);
    const { profile } = await loadRoutes();
    const res = await profile.GET(req("/api/profile", { origin: "https://evil.example" }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers '*' for any origin under a wildcard", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");
    const { projects } = await loadRoutes();
    const res = await projects.GET(req("/api/projects", { origin: "https://any.example" }));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  describe("OPTIONS preflight", () => {
    it("returns 204 with CORS headers for an allowed origin on every data route", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", ORIGIN);
      const routes = await loadRoutes();
      for (const [path, handler] of [
        ["/api/profile", routes.profile.OPTIONS],
        ["/api/experience", routes.experience.OPTIONS],
        ["/api/projects", routes.projects.OPTIONS],
        ["/api/projects/project-one", routes.project.OPTIONS],
      ] as const) {
        const res = handler(req(path, { origin: ORIGIN, method: "OPTIONS" }));
        expect(res.status, path).toBe(204);
        expect(await res.text()).toBe("");
        expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
        expect(res.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
        expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type");
        expect(res.headers.get("access-control-max-age")).toBe("86400");
      }
    });

    it("returns 204 without Allow-Origin when CORS is off", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
      const { projects } = await loadRoutes();
      const res = projects.OPTIONS(req("/api/projects", { origin: ORIGIN, method: "OPTIONS" }));
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("vary")).toBe("Origin");
    });
  });
});

describe("jsonResponse", () => {
  it("keeps caller headers and status while adding CORS headers", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");
    vi.resetModules();
    const { jsonResponse } = await import("@/lib/http/api");
    const res = jsonResponse(
      new Request(`${BASE}/x`, { headers: { origin: ORIGIN } }),
      { ok: true },
      { status: 201, headers: { "x-custom": "1" } },
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("x-custom")).toBe("1");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("unexpected repository errors", () => {
  /** Loads the routes with a repository whose every method rejects. */
  async function loadRoutesWithFailingRepository() {
    vi.resetModules();
    const failure = new Error("content failed validation");
    vi.doMock("@/lib/data", () => ({
      getRepository: () => ({
        getProfile: () => Promise.reject(failure),
        getProjects: () => Promise.reject(failure),
        getProjectBySlug: () => Promise.reject(failure),
        getExperience: () => Promise.reject(failure),
      }),
    }));
    const routes = {
      profile: await import("@/app/api/profile/route"),
      projects: await import("@/app/api/projects/route"),
      project: await import("@/app/api/projects/[slug]/route"),
      experience: await import("@/app/api/experience/route"),
    };
    return { routes, failure };
  }

  afterEach(() => {
    vi.doUnmock("@/lib/data");
    vi.restoreAllMocks();
  });

  it("returns 500 { error } JSON with CORS headers and logs the real error", async () => {
    vi.stubEnv("CORS_ALLOWED_ORIGINS", ORIGIN);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { routes, failure } = await loadRoutesWithFailingRepository();

    const responses = [
      await routes.profile.GET(req("/api/profile", { origin: ORIGIN })),
      await routes.experience.GET(req("/api/experience", { origin: ORIGIN })),
      await routes.projects.GET(req("/api/projects", { origin: ORIGIN })),
      await routes.project.GET(req("/api/projects/x", { origin: ORIGIN }), slugCtx("x")),
    ];

    for (const res of responses) {
      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
      // The generic message must not leak internal details.
      expect(await res.json()).toEqual({ error: "Internal server error" });
    }
    expect(consoleError).toHaveBeenCalledTimes(responses.length);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("/api/profile"), failure);
  });

  it("still returns 400 for bad input before touching the repository", async () => {
    const { routes } = await loadRoutesWithFailingRepository();
    const res = await routes.projects.GET(req("/api/projects?featured=nope"));
    expect(res.status).toBe(400);
  });
});
