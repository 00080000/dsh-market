/**
 * Response shapes of the /dsh-market/* host routes plus the pure helpers the
 * Market UI shares between its section and toast components.
 */

/** Localized text keyed by language ('zh' / 'en'). */
export type LocalizedText = Record<string, string | undefined>

/** One registry entry from /dsh-market/registry. */
export interface RegistryPlugin {
  name: string
  owner: string
  url: string
  npm?: string
  category: string
  description?: LocalizedText
  stars?: number
  added?: string
  install?: string
}

/** The catalog payload under `registry` in /dsh-market/registry. */
export interface Registry {
  count: number
  categories: Record<string, LocalizedText>
  plugins: RegistryPlugin[]
}

/** Profile dependency map: package name → install spec. */
export type InstalledMap = Record<string, string>

/** Per-package update status from /dsh-market/updates. */
export interface UpdateStatus {
  updateAvailable?: boolean
  version?: string
  kind?: string
}

/** Poll payload from /dsh-market/status. */
export interface MarketStatus {
  active?: boolean
  lastLine?: string
  seconds?: number
  installed?: InstalledMap
  pnpm?: boolean
  boot?: string
}

/** Registered theme definition surfaced by the theme service snapshot. */
export interface ThemeDef {
  id: string
  colorScheme?: string
  tokens?: Record<string, string | undefined>
}

/** Theme service snapshot; null when the composition has no theme service. */
export interface ThemeSnapshot {
  preference: string
  themes: ThemeDef[]
}

/** Bound locale translator for the dsh-market namespace. */
export type Translate = (key: string) => string

export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return 'hsl(' + (((hash % 360) + 360) % 360) + ' 55% 52%)'
}

export function repoOf(url: string): string | null {
  // Plain repo urls plus /tree/<branch>/<subpath> monorepo links.
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/.+)?\/?$/.exec(url)
  return m ? m[1]! : null
}

export function readSession(key: string): any {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') } catch { return null }
}

/** Heuristic: plugins that target a terminal surface rather than the web UI. */
export function looksTerminal(plugin: RegistryPlugin, lang: string): boolean {
  const desc = (plugin.description && (plugin.description[lang] || plugin.description.en)) || ''
  return /\b(tui|cli|tty|terminal)\b|终端|命令行/i.test(plugin.name + ' ' + desc)
}

/** Filters and sort order driving the discover list. */
export interface ListQuery {
  /** Active category id, or 'all'. */
  category: string
  /** Raw search input (trimmed and lowercased internally). */
  query: string
  /** UI language for description matching ('zh' / 'en'). */
  lang: string
  /** 'hot' (stars desc), 'new' (added desc), anything else keeps registry order. */
  sort: string
}

/**
 * The discover list: category filter, then search across name / owner /
 * localized description, then the selected sort. Pure — the section renders
 * exactly this.
 */
export function visiblePlugins(plugins: RegistryPlugin[], options: ListQuery): RegistryPlugin[] {
  const query = options.query.trim().toLowerCase()
  const list = plugins.filter((p) => {
    if (options.category !== 'all' && p.category !== options.category) return false
    if (query === '') return true
    const desc = (p.description && (p.description[options.lang] || p.description.en)) || ''
    return p.name.toLowerCase().includes(query)
      || p.owner.toLowerCase().includes(query)
      || desc.toLowerCase().includes(query)
  })
  if (options.sort === 'hot') {
    return [...list].sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))
  }
  if (options.sort === 'new') {
    return [...list].sort((a, b) => String(b.added).localeCompare(String(a.added)))
  }
  return list
}

/** The themes tab listing: theme category only, most-starred first. */
export function themePlugins(plugins: RegistryPlugin[]): RegistryPlugin[] {
  return plugins.filter(p => p.category === 'theme').sort((a, b) => (b.stars || 0) - (a.stars || 0))
}

/**
 * Category chip order: collapsed with an active non-'all' chip, the active
 * one moves to the front so it stays visible inside the two-row clip.
 */
export function orderedCategories(categories: string[], active: string, open: boolean): string[] {
  return open || active === 'all' ? categories : [active, ...categories.filter(id => id !== active)]
}

/**
 * Unified installed-state matching (#15): both sides collapse to lowercase
 * identity sets — the registry entry contributes its bare name, npm name and
 * owner/repo; the dependency contributes its key and the repo inside its
 * spec — and any exact intersection counts. Exact equality, not substrings,
 * so prefix-related repo names cannot cross-match.
 */
function entryIdentities(plugin: RegistryPlugin): Set<string> {
  const ids = new Set<string>([plugin.name.toLowerCase()])
  if (plugin.npm) ids.add(plugin.npm.toLowerCase())
  // Subpath-aware: a /tree/ entry identifies as repo#path:/sub, never the
  // bare repo — two subpackages of one monorepo must not cross-match.
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/tree\/[^/]+\/(.+?))?\/?$/.exec(plugin.url)
  if (m !== null) {
    ids.add(m[2] !== undefined ? `${m[1]!.toLowerCase()}#path:/${m[2].toLowerCase()}` : m[1]!.toLowerCase())
  }
  return ids
}

function depIdentities(name: string, spec: string): Set<string> {
  const ids = new Set<string>([name.toLowerCase()])
  // A scoped npm key usually mirrors owner/repo — expose that identity so an
  // npm-installed plugin still matches an entry whose npm field is unset.
  const scoped = /^@([^/]+)\/(.+)$/.exec(name)
  if (scoped !== null) ids.add(`${scoped[1]!.toLowerCase()}/${scoped[2]!.toLowerCase()}`)
  const match = /github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:#path:\/([A-Za-z0-9_./-]+))?/i.exec(spec)
  if (match !== null) {
    ids.add(match[1]!.toLowerCase())
    if (match[2] !== undefined) ids.add(`${match[1]!.toLowerCase()}#path:/${match[2].toLowerCase()}`)
  }
  return ids
}

/** The installed dependency name a registry entry corresponds to, or null. */
export function matchInstalledName(plugin: RegistryPlugin, installed: InstalledMap): string | null {
  const ids = entryIdentities(plugin)
  for (const [name, spec] of Object.entries(installed)) {
    for (const id of depIdentities(name, String(spec))) {
      if (ids.has(id)) return name
    }
  }
  return null
}

/** The registry entry an installed dependency corresponds to, or undefined. */
export function entryForDep(plugins: RegistryPlugin[], name: string, spec: string): RegistryPlugin | undefined {
  const ids = depIdentities(name, String(spec))
  return plugins.find((plugin) => {
    for (const id of entryIdentities(plugin)) if (ids.has(id)) return true
    return false
  })
}

export function isInstalled(plugin: RegistryPlugin, installed: InstalledMap): boolean {
  return matchInstalledName(plugin, installed) !== null
}

/**
 * The header brand mark now lives in MarketSection.tsx as an inline SVG
 * (official-style monochrome glyph, fill="currentColor") so it follows the
 * active theme; the colored assets/logo.svg tile is no longer inlined here.
 */

/** Four representative colors for a theme card's preview strip. */
export function themeSwatch(def: ThemeDef): string[] {
  const tk = def.tokens || {}
  const pick = (names: string[]) => { for (const n of names) { if (tk[n]) return tk[n]! } return null }
  const dark = def.colorScheme === 'dark'
  return [
    pick(['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1']) || (dark ? '#0f1115' : '#ffffff'),
    pick(['--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay']) || (dark ? '#1a1d23' : '#f3f4f6'),
    pick(['--dsw-alias-brand-primary']) || '#4f6ef7',
    pick(['--dsw-alias-label-primary']) || (dark ? '#e5e7eb' : '#1f2328'),
  ]
}
