import "server-only";
import experienceData from "@/data/experience.json";
import profileData from "@/data/profile.json";
import projectsData from "@/data/projects.json";
import {
  experienceListSchema,
  profileSchema,
  projectListSchema,
  type Experience,
  type Profile,
  type Project,
} from "@/lib/schemas";
import {
  deepFreeze,
  sortByStartDateDesc,
  type GetProjectsOptions,
  type PortfolioRepository,
} from "./repository";

/** Raw, unvalidated content as it comes from the source. */
export interface JsonSourceData {
  profile: unknown;
  projects: unknown;
  experience: unknown;
}

const bundledData: JsonSourceData = {
  profile: profileData,
  projects: projectsData,
  experience: experienceData,
};

/**
 * Reads portfolio content from the JSON files in `src/data/`.
 *
 * The files are imported statically, so they are bundled at build time and every page
 * can be prerendered. Content is validated with zod on first access, then deep-frozen and
 * memoized, so callers share one read-only copy.
 * Methods are async to match adapters that fetch remote content.
 */
export class JsonRepository implements PortfolioRepository {
  private readonly source: JsonSourceData;
  private profile?: Profile;
  private projects?: Project[];
  private experience?: Experience[];

  /** @param source Raw content to read; defaults to the bundled JSON files (override in tests). */
  constructor(source: JsonSourceData = bundledData) {
    this.source = source;
  }

  /** {@inheritDoc PortfolioRepository.getProfile} */
  async getProfile(): Promise<Profile> {
    this.profile ??= deepFreeze(profileSchema.parse(this.source.profile));
    return this.profile;
  }

  /** {@inheritDoc PortfolioRepository.getProjects} */
  async getProjects(options: GetProjectsOptions = {}): Promise<Project[]> {
    this.projects ??= deepFreeze(
      sortByStartDateDesc(projectListSchema.parse(this.source.projects)),
    );
    const { featured } = options;
    return featured === undefined
      ? this.projects
      : this.projects.filter((project) => project.featured === featured);
  }

  /** {@inheritDoc PortfolioRepository.getProjectBySlug} */
  async getProjectBySlug(slug: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find((project) => project.slug === slug) ?? null;
  }

  /** {@inheritDoc PortfolioRepository.getExperience} */
  async getExperience(): Promise<Experience[]> {
    this.experience ??= deepFreeze(
      sortByStartDateDesc(experienceListSchema.parse(this.source.experience)),
    );
    return this.experience;
  }
}
