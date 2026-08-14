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

/** A registry plugin counts as installed when its package name, npm name, or GitHub spec appears in the profile dependencies. */
export function isInstalled(plugin: RegistryPlugin, installed: InstalledMap): boolean {
  if (installed[plugin.name] !== undefined) return true
  if (plugin.npm && installed[plugin.npm] !== undefined) return true
  const repo = repoOf(plugin.url)
  if (repo === null) return false
  const needle = ('github:' + repo).toLowerCase()
  return Object.values(installed).some(spec => String(spec).toLowerCase().includes(needle))
}

/**
 * The brand mark (assets/logo.svg — shared block-grid mark with
 * awesome-dsh-plugin), inlined so the header needs no extra request.
 */
export const LOGO_URI = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#f6f2ea"/><g transform="translate(15.7 16.7) scale(0.3) translate(-112 -78)"><g fill="#2b2620"><rect x="112" y="112" width="88" height="88" rx="14"/><rect x="212" y="112" width="88" height="88" rx="14"/><rect x="112" y="212" width="88" height="88" rx="14"/><rect x="212" y="212" width="88" height="88" rx="14"/><rect x="112" y="312" width="88" height="88" rx="14"/><rect x="212" y="312" width="88" height="88" rx="14"/><rect x="312" y="212" width="88" height="88" rx="14"/><rect x="312" y="312" width="88" height="88" rx="14"/></g><rect x="346" y="78" width="88" height="88" rx="14" fill="#c0392b" transform="rotate(9 390 122)"/></g></svg>')

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
