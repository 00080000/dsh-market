/**
 * Download regions: which route the market's own network requests take.
 *
 * Almost every external request the market makes lands on npm's registry or
 * on GitHub — the plugin catalog, update checks, package downloads, plugin
 * tarballs, author avatars, README screenshots. From mainland China all of
 * those are slow at once, which is why this is ONE setting rather than a
 * row of them: "npm mirror", "GitHub proxy" and "image proxy" are three
 * spellings of a single question the user is actually being asked, which is
 * where they are.
 *
 * The routing table is the single source of truth. Every consumer asks it
 * rather than reaching for a hardcoded host, so adding a region is a table
 * entry instead of a search across six modules.
 *
 * Each route has an environment escape hatch, following `DSHM_REGISTRY_URL`
 * (src/registry.ts). The China route leans on a free public proxy for the
 * GitHub half; those come and go, and a user whose proxy has died needs a
 * way out that is not "wait for the next release".
 */

/** A region the market can download from. */
export type Region = 'global' | 'china'

/** Every region a user may pick. */
export const REGIONS: readonly Region[] = ['global', 'china']

/** Narrow an untrusted value to a Region, or null. */
export function asRegion(value: unknown): Region | null {
  return value === 'global' || value === 'china' ? value : null
}

/**
 * The npm registry the market and pnpm read, no trailing slash.
 *
 * Exported because callers need to tell "this region uses the default" from
 * "this region names a mirror" — the difference between leaving a spawned
 * pnpm's registry alone and setting it.
 */
export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_CHINA = 'https://mirrors.cloud.tencent.com/npm'

/**
 * Prefix proxy for github.com-family URLs, no trailing slash.
 *
 * Verified against gh-proxy: it serves the GitHub API and commit-pinned
 * codeload tarballs, and it refuses anything that is not a github.com
 * hostname — which is why the catalog has to travel the raw.githubusercontent
 * path rather than the project's own domain.
 */
const GITHUB_PROXY_CHINA = 'https://gh-proxy.com'

/**
 * The catalog's stable public address.
 *
 * A custom domain rather than the repository path, deliberately: it survives
 * the repo being renamed or moved, and Pages puts a CDN in front of it.
 */
const CATALOG_OFFICIAL = 'https://awesome-dsh-plugin.com/plugins.json'

/**
 * The same file read straight from the repository that owns it.
 *
 * `plugins.json` is committed source, not a build artifact — the Pages site
 * renders FROM it. That is what makes this path exist at all, and it is the
 * only form a github.com-family proxy will carry.
 */
const CATALOG_RAW = 'https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/HEAD/plugins.json'

/** Where one region sends each kind of request. `null` means "go direct". */
export interface RegionRoutes {
  /** npm registry base, no trailing slash. */
  npmRegistry: string
  /** Prefix proxy for github.com-family URLs, or null to go direct. */
  githubProxy: string | null
  /** Full URL of the plugin catalog. */
  catalogUrl: string
  /**
   * Where to fall back when `catalogUrl` fails.
   *
   * The catalog is the FIRST request the market makes, so a dead proxy would
   * mean an empty market rather than a slow one. `null` for the global route:
   * it is already the fallback.
   */
  catalogFallback: string | null
}

const ROUTES: Record<Region, RegionRoutes> = {
  global: {
    npmRegistry: DEFAULT_NPM_REGISTRY,
    githubProxy: null,
    catalogUrl: CATALOG_OFFICIAL,
    catalogFallback: null,
  },
  china: {
    npmRegistry: NPM_CHINA,
    githubProxy: GITHUB_PROXY_CHINA,
    catalogUrl: `${GITHUB_PROXY_CHINA}/${CATALOG_RAW}`,
    catalogFallback: CATALOG_OFFICIAL,
  },
}

/** Read an environment override, treating blank as unset. */
function override(env: NodeJS.ProcessEnv, name: string): string | null {
  const raw = env[name]
  return raw !== undefined && raw.trim() !== '' ? raw.trim().replace(/\/+$/, '') : null
}

/**
 * The routes for a region, with environment overrides applied.
 *
 * Overrides win over the table because they are the user's statement about
 * their own network, and they are the way out when a public proxy dies.
 *
 * `DSHM_REGISTRY_URL` keeps its existing meaning — the catalog URL — and
 * when set it also clears the fallback: someone pointing the market at their
 * own catalog does not want it quietly reverting to ours.
 */
export function routesFor(region: Region, env: NodeJS.ProcessEnv = process.env): RegionRoutes {
  const base = ROUTES[region]
  const npmMirror = override(env, 'DSHM_NPM_MIRROR')
  const githubProxy = override(env, 'DSHM_GITHUB_PROXY')
  const catalog = override(env, 'DSHM_REGISTRY_URL')
  return {
    npmRegistry: npmMirror ?? base.npmRegistry,
    // An empty override is how a user turns the proxy OFF while staying in
    // the China region for the npm half — `has the variable` is not the same
    // question as `has a value`, and only the second one routes traffic.
    githubProxy: githubProxy ?? base.githubProxy,
    catalogUrl: catalog ?? base.catalogUrl,
    catalogFallback: catalog !== null ? null : base.catalogFallback,
  }
}

/**
 * The region this process is running under.
 *
 * One piece of module state rather than a parameter threaded through the
 * catalog, the theme manager, update checks and every pnpm spawn: the region
 * is a property of the running market, not of any single question asked of
 * it, and the call graphs that need it are several frames deep.
 *
 * Consumers that must react to a CHANGE (dropping a cache gathered from the
 * other registry) keep their own setter beside this one; this holds the
 * answer for everyone who only needs to read it.
 */
let active: Region = 'global'

/** The region in force. */
export function activeRegion(): Region {
  return active
}

/** Set the region in force. Callers are responsible for their own caches. */
export function setActiveRegion(region: Region): void {
  active = region
}

/**
 * Wrap a github.com-family URL in a prefix proxy.
 *
 * The proxy takes the full absolute URL as its path (`{proxy}/{url}`) rather
 * than a rewritten hostname, which is what lets one prefix serve api,
 * codeload, raw and the web host without a mapping table per service.
 *
 * @param proxy - the prefix, or null to go direct.
 * @param url - an absolute https URL on a github.com-family host.
 * @returns the proxied URL, or `url` unchanged when there is no proxy.
 */
export function throughProxy(proxy: string | null, url: string): string {
  return proxy === null ? url : `${proxy}/${url}`
}
