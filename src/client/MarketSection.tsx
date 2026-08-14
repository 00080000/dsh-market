/**
 * The Market settings section: Discover / Themes / Installed tabs over the
 * /dsh-market/* host routes, with install/update/uninstall flows and the
 * pending-restart bookkeeping in sessionStorage.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import css from './Market.module.css'
import {
  avatarColor, isInstalled, LOGO_URI, looksTerminal, readSession, repoOf, themeSwatch,
} from './market-data.ts'
import type {
  InstalledMap, Registry, RegistryPlugin, ThemeSnapshot, Translate, UpdateStatus,
} from './market-data.ts'

/**
 * Card avatar: the plugin owner's GitHub avatar (no API, browser-cached),
 * falling back to the initial-letter tile when it can't load.
 */
function OwnerAvatar({ name, owner }: { name: string; owner: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || owner === '') {
    return (
      <div className={css.av} style={{ background: avatarColor(name) }}>
        {name.replace(/^dsh[-_]/i, '').charAt(0).toUpperCase() || 'P'}
      </div>
    )
  }
  return (
    <img
      className={css.av}
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=96`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export interface MarketSectionProps {
  t: Translate
  locale: {
    subscribe(callback: () => void): () => void
    getSnapshot(): { active: string }
  }
  theme: { setTheme(id: string): void }
  themeStore: {
    subscribe(callback: () => void): () => void
    getSnapshot(): ThemeSnapshot | null
  }
}

export function MarketSection(props: MarketSectionProps) {
  const t = props.t
  const localeSnap = useSyncExternalStore(
    cb => props.locale.subscribe(cb),
    () => props.locale.getSnapshot(),
  )
  const lang = String(localeSnap.active).toLowerCase().startsWith('zh') ? 'zh' : 'en'
  // null when the composition has no theme service — the Themes tab hides.
  const themeSnap = useSyncExternalStore(
    props.themeStore.subscribe,
    props.themeStore.getSnapshot,
  )
  const [data, setData] = useState<Registry | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [installed, setInstalled] = useState<InstalledMap>({})
  const [skins, setSkins] = useState<string[]>([])
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem('dshm-tab')
    if (saved !== null) sessionStorage.removeItem('dshm-tab')
    return saved || 'discover'
  })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [confirming, setConfirming] = useState<RegistryPlugin | null>(null)
  const [busyUrl, setBusyUrl] = useState<string | null>(null)
  const [doneUrls, setDoneUrls] = useState<string[]>([])
  const [installError, setInstallError] = useState<string | null>(null)
  const [updates, setUpdates] = useState<Record<string, UpdateStatus>>({})
  const [updatingName, setUpdatingName] = useState<string | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [updatedNames, setUpdatedNames] = useState<string[]>([])
  const [hotUrls, setHotUrls] = useState<string[]>([])
  const [hotNames, setHotNames] = useState<string[]>([])
  const [progressLine, setProgressLine] = useState<string | null>(null)
  const [removeArmed, setRemoveArmed] = useState<string | null>(null)
  const [removingName, setRemovingName] = useState<string | null>(null)
  const [removedCount, setRemovedCount] = useState(0)
  const [envReady, setEnvReady] = useState(true)
  const [envFixing, setEnvFixing] = useState(false)
  const [envFailed, setEnvFailed] = useState(false)
  const [bootId, setBootId] = useState<string | null>(null)
  const [showTop, setShowTop] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [sort, setSort] = useState('hot')

  const refreshInstalled = useCallback((force?: boolean) => {
    fetch('/dsh-market/installed', { cache: 'no-store' })
      .then(res => res.json())
      .then(body => {
        setInstalled(body.installed || {})
        setSkins(body.live || [])
      })
      .catch(() => {})
    fetch('/dsh-market/updates' + (force === true ? '?force=1' : ''), { cache: 'no-store' })
      .then(res => res.json())
      .then(body => setUpdates(body.updates || {}))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/dsh-market/registry', { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
      .then(body => setData(body.registry))
      .catch(() => setLoadError(true))
    fetch('/dsh-market/status', { cache: 'no-store' })
      .then(res => res.json())
      .then(status => {
        setEnvReady(status.pnpm !== false)
        if (typeof status.boot === 'string') setBootId(status.boot)
      })
      .catch(() => {})
    refreshInstalled()
  }, [refreshInstalled])

  // Pending-restart flags survive tab switches and page reloads, scoped to
  // one host process: a different boot id means the restart happened and the
  // stale banner must not resurrect.
  useEffect(() => {
    if (bootId === null) return
    const saved = readSession('dshm-restart')
    if (saved === null) return
    if (saved.boot !== bootId) {
      sessionStorage.removeItem('dshm-restart')
      return
    }
    if (Array.isArray(saved.doneUrls) && saved.doneUrls.length > 0) setDoneUrls(saved.doneUrls)
    if (Array.isArray(saved.updated) && saved.updated.length > 0) setUpdatedNames(saved.updated)
    if (typeof saved.removed === 'number' && saved.removed > 0) setRemovedCount(saved.removed)
  }, [bootId])

  useEffect(() => {
    if (bootId === null) return
    if (doneUrls.length === 0 && updatedNames.length === 0 && removedCount === 0) return
    sessionStorage.setItem('dshm-restart', JSON.stringify({
      boot: bootId,
      doneUrls,
      updated: updatedNames,
      removed: removedCount,
    }))
  }, [bootId, doneUrls, updatedNames, removedCount])

  const fixEnv = useCallback(() => {
    setEnvFixing(true)
    setEnvFailed(false)
    fetch('/dsh-market/setup-pnpm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(res => res.json())
      .then(body => {
        if (body.ok) setEnvReady(true)
        else setEnvFailed(true)
      })
      .catch(() => setEnvFailed(true))
      .finally(() => setEnvFixing(false))
  }, [])

  // Recover an install whose HTTP response was lost (page navigated away or
  // the connection dropped): the pending marker survives in sessionStorage and
  // the poll below converges the button state from the host's ground truth.
  useEffect(() => {
    const pending = readSession('dshm-pending')
    if (pending !== null && typeof pending.url === 'string') setBusyUrl(pending.url)
  }, [])

  useEffect(() => {
    if (busyUrl === null && updatingName === null) {
      setProgressLine(null)
      return
    }
    const timer = setInterval(() => {
      fetch('/dsh-market/status', { cache: 'no-store' })
        .then(res => res.json())
        .then(status => {
          if (status.active) {
            setProgressLine((status.lastLine || '…') + '  (' + status.seconds + 's)')
          } else {
            setProgressLine(null)
            setInstalled(status.installed || {})
            const pending = readSession('dshm-pending')
            if (pending !== null && busyUrl !== null) {
              const nowInstalled = data !== null && data.plugins.some(p =>
                p.url === busyUrl && isInstalled(p, status.installed || {}))
              if (nowInstalled) {
                sessionStorage.removeItem('dshm-pending')
                setDoneUrls(urls => urls.includes(busyUrl) ? urls : urls.concat(busyUrl))
                setBusyUrl(null)
              }
            }
          }
        })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [busyUrl, updatingName, data])

  const plugins = useMemo(() => {
    if (data === null) return []
    const query = q.trim().toLowerCase()
    const list = data.plugins.filter(p => {
      if (cat !== 'all' && p.category !== cat) return false
      if (query === '') return true
      const desc = (p.description && (p.description[lang] || p.description.en)) || ''
      return p.name.toLowerCase().includes(query)
        || p.owner.toLowerCase().includes(query)
        || desc.toLowerCase().includes(query)
    })
    if (sort === 'hot') {
      return [...list].sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))
    }
    if (sort === 'new') {
      return [...list].sort((a, b) => String(b.added).localeCompare(String(a.added)))
    }
    return list
  }, [data, q, cat, lang, sort])

  const doInstall = useCallback((plugin: RegistryPlugin) => {
    setConfirming(null)
    setInstallError(null)
    setBusyUrl(plugin.url)
    sessionStorage.setItem('dshm-pending', JSON.stringify({ url: plugin.url }))
    fetch('/dsh-market/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: plugin.url }),
    })
      .then(res => res.json().then(body => ({ status: res.status, body })))
      .then(({ status, body }) => {
        sessionStorage.removeItem('dshm-pending')
        if (status === 200 && body.ok && body.hot && plugin.category === 'theme') {
          // Themes auto-activate on install; reload straight into the Themes
          // tab so the new look is on screen immediately.
          sessionStorage.setItem('dshm-toast', JSON.stringify([plugin.name]))
          sessionStorage.setItem('dshm-tab', 'themes')
          location.reload()
          return
        }
        if (status === 200 && body.ok) {
          sessionStorage.setItem('dshm-tab', 'installed')
          if (body.hot) {
            setHotUrls(urls => urls.includes(plugin.url) ? urls : urls.concat(plugin.url))
            setHotNames(names => names.includes(plugin.name) ? names : names.concat(plugin.name))
          } else {
            setDoneUrls(urls => urls.includes(plugin.url) ? urls : urls.concat(plugin.url))
          }
          refreshInstalled()
        } else {
          const text = (v: unknown) => typeof v === 'string' ? v : (v && typeof (v as any).text === 'string') ? (v as any).text : v == null ? '' : JSON.stringify(v)
          const detail = text(body.error) || text(body.stderr) || text(body.stdout) || ('exit ' + body.exitCode)
          setInstallError(t('installFail') + ': ' + plugin.name + ' — ' + detail.trim().slice(-600))
        }
      })
      .catch(error => {
        sessionStorage.removeItem('dshm-pending')
        setInstallError(t('installFail') + ': ' + String(error))
      })
      .finally(() => setBusyUrl(null))
  }, [refreshInstalled, t])

  const doUpdate = useCallback((name: string) => {
    setInstallError(null)
    setUpdatingName(name)
    return fetch('/dsh-market/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => res.json().then(body => ({ status: res.status, body })))
      .then(({ status, body }) => {
        if (status === 200 && body.ok) {
          setUpdatedNames(names => names.concat(name))
          refreshInstalled()
        } else {
          const text = (v: unknown) => typeof v === 'string' ? v : (v && typeof (v as any).text === 'string') ? (v as any).text : v == null ? '' : JSON.stringify(v)
          const detail = text(body.error) || text(body.stderr) || text(body.stdout) || ('exit ' + body.exitCode)
          setInstallError(t('updateFail') + ': ' + name + ' — ' + detail.trim().slice(-600))
        }
      })
      .catch(error => setInstallError(t('updateFail') + ': ' + String(error)))
      .finally(() => setUpdatingName(null))
  }, [refreshInstalled, t])

  const doUseSkin = useCallback((name: string) => {
    setInstallError(null)
    fetch('/dsh-market/use-skin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => res.json().then(body => ({ status: res.status, body })))
      .then(({ status, body }) => {
        if (status === 200 && body.ok) {
          sessionStorage.setItem('dshm-toast', JSON.stringify([name]))
          sessionStorage.setItem('dshm-toast-mode', 'theme')
          sessionStorage.setItem('dshm-tab', 'themes')
          location.reload()
        } else {
          setInstallError(String(body.error || 'failed'))
        }
      })
      .catch(error => setInstallError(String(error)))
  }, [])

  const doUninstall = useCallback((name: string) => {
    setRemoveArmed(null)
    setInstallError(null)
    setRemovingName(name)
    return fetch('/dsh-market/uninstall', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => res.json().then(body => ({ status: res.status, body })))
      .then(({ status, body }) => {
        if (status === 200 && body.ok) {
          if (!body.hot) setRemovedCount(n => n + 1)
          refreshInstalled()
        } else {
          const text = (v: unknown) => typeof v === 'string' ? v : (v && typeof (v as any).text === 'string') ? (v as any).text : v == null ? '' : JSON.stringify(v)
          setInstallError((text(body.error) || text(body.stderr) || 'error').trim().slice(-600))
        }
      })
      .catch(error => setInstallError(String(error)))
      .finally(() => setRemovingName(null))
  }, [refreshInstalled])

  // The market itself stays out of the batch: its update reloads this page
  // mid-run, which would strand the remaining items.
  const selfName = installed['dshmarket'] !== undefined ? 'dshmarket' : 'dsh-market'
  const updatableNames = Object.keys(installed).filter(
    name => name !== selfName && !updatedNames.includes(name) && updates[name] && updates[name].updateAvailable,
  )

  const doUpdateAll = useCallback(() => {
    const names = updatableNames.slice()
    setUpdatingAll(true)
    const next = () => {
      const name = names.shift()
      if (name === undefined) {
        setUpdatingAll(false)
        return
      }
      doUpdate(name).then(next, next)
    }
    next()
  }, [updatableNames, doUpdate])

  const pendingRestart = doneUrls.length + updatedNames.length + removedCount
  const hasUpdates = Object.keys(installed).some(
    name => !updatedNames.includes(name) && updates[name] && updates[name].updateAvailable,
  )

  const themePlugins = data === null ? [] : data.plugins
    .filter(p => p.category === 'theme')
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))

  const pluginCard = (p: RegistryPlugin) => {
    const desc = (p.description && (p.description[lang] || p.description.en)) || ''
    const done = doneUrls.includes(p.url) || hotUrls.includes(p.url)
    const already = isInstalled(p, installed)
    const busy = busyUrl === p.url
    return (
      <div key={p.url} className={css.card}>
        <div className={css.row1}>
          <OwnerAvatar name={p.name} owner={p.owner || ''} />
          <div style={{ minWidth: 0 }}>
            <div className={css.nm}>{p.name}</div>
            <div className={css.owner}>
              {p.owner}
              {typeof p.stars === 'number' && <span className={css.star}>{' · ★ ' + p.stars}</span>}
            </div>
          </div>
          <span className={css.grow} />
          <a className={css.src} href={p.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', flexShrink: 0 }}>{t('viewSource')}</a>
        </div>
        <div className={css.desc}>{desc}</div>
        <div className={css.foot}>
          <span className={css.cat}>
            {(data!.categories[p.category] && (data!.categories[p.category]![lang] || data!.categories[p.category]!.en)) || p.category}
          </span>
          <span className={css.grow} />
          {done
            ? <button className={`${css.btn} ${css.done}`}>{t('installedBadge')}</button>
            : already
              ? <button className={`${css.btn} ${css.done}`}>{t('alreadyInstalled')}</button>
              : busy
                ? <button className={`${css.btn} ${css.install} ${css.busy}`}>{t('installing')}</button>
                : (
                    <button
                      className={`${css.btn} ${css.install}`}
                      disabled={busyUrl !== null || !envReady}
                      onClick={() => setConfirming(p)}
                    >{t('install')}</button>
                  )}
        </div>
        {busy && (
          <div className={css.progress} style={{ margin: '6px 0 0' }}>
            <span className={css.spin} />
            <code className={css.grow}>{progressLine || t('progressHint')}</code>
          </div>
        )}
      </div>
    )
  }

  const installedNameOf = (p: RegistryPlugin) => {
    if (installed[p.name] !== undefined) return p.name
    const repo = repoOf(p.url)
    if (repo === null) return null
    const needle = ('github:' + repo).toLowerCase()
    for (const [name, spec] of Object.entries(installed)) {
      if (String(spec).toLowerCase().includes(needle)) return name
    }
    return null
  }

  // Plugins loaded at boot (bundle-layer skins) aren't in the shim list but
  // are just as live; the boot manifest is the page's own record of them.
  const bootEntries = (typeof window !== 'undefined' && window.__DSH_BOOT__ && Array.isArray(window.__DSH_BOOT__.entries))
    ? window.__DSH_BOOT__.entries
    : []

  // Unified card for the Themes tab: install → use/in-use → uninstall.
  const themePluginCard = (p: RegistryPlugin) => {
    const instName = installedNameOf(p)
    if (instName === null) return pluginCard(p)
    const mounted = skins.includes(instName) || bootEntries.some(e => e.id === instName)
    const desc = (p.description && (p.description[lang] || p.description.en)) || ''
    return (
      <div key={p.url} className={css.card}>
        <div className={css.row1}>
          <OwnerAvatar name={p.name} owner={p.owner || ''} />
          <div style={{ minWidth: 0 }}>
            <div className={css.nm}>{p.name}</div>
            <div className={css.owner}>
              {p.owner}
              {typeof p.stars === 'number' && <span className={css.star}>{' · ★ ' + p.stars}</span>}
            </div>
          </div>
          <span className={css.grow} />
          <a className={css.src} href={p.url} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', flexShrink: 0 }}>{t('viewSource')}</a>
        </div>
        <div className={css.desc}>{desc}</div>
        <div className={css.foot}>
          <span className={css.grow} />
          {removingName === instName
            ? <button className={`${css.btn} ${css.danger} ${css.busy}`}>{t('uninstalling')}</button>
            : removeArmed === instName
              ? (
                  <button
                    className={`${css.btn} ${css.danger} ${css.armed}`}
                    onClick={() => doUninstall(instName).then(() => {
                      if (mounted) {
                        sessionStorage.setItem('dshm-tab', 'themes')
                        location.reload()
                      }
                    })}
                  >{t('confirmRemove')}</button>
                )
              : <button className={`${css.btn} ${css.danger}`} onClick={() => setRemoveArmed(instName)}>{t('uninstall')}</button>}
          {mounted
            ? <button className={`${css.btn} ${css.done}`}>{t('themeActive')}</button>
            : <button className={`${css.btn} ${css.install}`} onClick={() => doUseSkin(instName)}>{t('themeApply')}</button>}
        </div>
      </div>
    )
  }

  const themeCard = (id: string, label: string, swatch: string[]) => {
    const active = themeSnap !== null && themeSnap.preference === id
    return (
      <div key={'th-' + id} className={css.card}>
        <div className={css.swatches}>{swatch.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
        <div className={css.foot}>
          <span className={css.nm}>{label}</span>
          <span className={css.grow} />
          {active
            ? <button className={`${css.btn} ${css.done}`}>{t('themeActive')}</button>
            : (
                <button
                  className={`${css.btn} ${css.install}`}
                  onClick={() => { try { props.theme.setTheme(id) } catch (error) { setInstallError(String(error)) } }}
                >{t('themeApply')}</button>
              )}
        </div>
      </div>
    )
  }

  const categories = data === null ? [] : Object.keys(data.categories)

  return (
    <div className={css.root}>
      <div className={css.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={LOGO_URI} width={22} height={22} alt="" style={{ borderRadius: '5px', flexShrink: 0 }} />
          <h2 className={css.title}>{t('nav')}</h2>
          {(() => {
            const self = installed['dshmarket'] !== undefined ? 'dshmarket' : 'dsh-market'
            return updates[self] && updates[self].updateAvailable && !updatedNames.includes(self)
              && (
                <button
                  className={`${css.btn} ${css.upd}`}
                  style={{ fontSize: '11px', padding: '3px 10px' }}
                  disabled={updatingName !== null || busyUrl !== null}
                  onClick={() => { setTab('installed'); doUpdate(self) }}
                >{updatingName === self ? t('updating') : t('marketUpdate')}</button>
              )
          })()}
          {updatableNames.length >= 2 && (
            <button
              className={`${css.btn} ${css.upd}`}
              style={{ fontSize: '11px', padding: '3px 10px' }}
              disabled={updatingAll || updatingName !== null || busyUrl !== null || removingName !== null}
              onClick={() => { setTab('installed'); doUpdateAll() }}
            >{updatingAll ? t('updating') : t('updateAll') + ' (' + updatableNames.length + ')'}</button>
          )}
        </div>
        <div className={css.sub}>
          {t('subtitle') + (data ? ' · ' + data.count : '') + ' · '}
          <a className={css.src} href="/dsh-market/logs" download="dsh-market-log.txt">{t('exportLog')}</a>
        </div>
        <div className={css.tabs}>
          <button className={tab === 'discover' ? `${css.tab} ${css.on}` : css.tab} onClick={() => setTab('discover')}>{t('tabDiscover')}</button>
          {themeSnap !== null && <button className={tab === 'themes' ? `${css.tab} ${css.on}` : css.tab} onClick={() => setTab('themes')}>{t('tabThemes')}</button>}
          <button className={tab === 'installed' ? `${css.tab} ${css.on}` : css.tab} onClick={() => { setTab('installed'); refreshInstalled(true) }}>
            {t('tabInstalled') + (Object.keys(installed).length > 0 ? ' (' + Object.keys(installed).length + ')' : '')}
            {hasUpdates && <span className={css.dot} />}
          </button>
          <span className={css.grow} />
          {tab === 'discover' && data !== null && (
            <div className={css.sort}>
              {['hot', 'new'].map(key => (
                <button
                  key={key}
                  className={sort === key ? css.on : ''}
                  onClick={() => setSort(key)}
                >{t(key === 'hot' ? 'sortHot' : 'sortNew')}</button>
              ))}
            </div>
          )}
          <input className={css.searchInline} placeholder={t('searchPh')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {!envReady && (
          <div className={css.restart}>
            <span>🧩</span>
            <span className={css.grow}>{envFailed ? t('envFixFail') : t('envMissing')}</span>
            {!envFailed && (
              <button
                className={envFixing ? `${css.btn} ${css.install} ${css.busy}` : `${css.btn} ${css.install}`}
                disabled={envFixing}
                onClick={fixEnv}
              >{envFixing ? t('envFixing') : t('envFix')}</button>
            )}
          </div>
        )}
        {hotUrls.length > 0 && (
          <div className={css.restart}>
            <span>✨</span>
            <span className={css.grow}><b>{hotUrls.length}</b> {t('hotBanner')}</span>
            <button
              className={`${css.btn} ${css.install}`}
              onClick={() => {
                sessionStorage.setItem('dshm-toast', JSON.stringify(hotNames))
                sessionStorage.setItem('dshm-tab', 'installed')
                location.reload()
              }}
            >{t('refresh')}</button>
          </div>
        )}
        {pendingRestart > 0 && (
          <div className={css.restart}>
            <span>🔄</span>
            <span className={css.grow}><b>{pendingRestart}</b> {t('restartBanner')}</span>
            <span title={t('restartHint')}>ℹ️</span>
          </div>
        )}
      </div>
      {installError !== null && <div className={css.err}>{installError}</div>}
      <div
        className={css.body}
        ref={bodyRef}
        onScroll={e => setShowTop(e.currentTarget.scrollTop > 400)}
      >
        {tab === 'discover'
          ? loadError
            ? <div className={css.empty}>{t('loadFail')}</div>
            : data === null
              ? <div className={css.loading}><span className={css.spin} />{t('loading')}</div>
              : (
                  <>
                    <div className={css.cats}>
                      <button className={cat === 'all' ? `${css.chip} ${css.on}` : css.chip} onClick={() => setCat('all')}>{t('all')}</button>
                      {categories.map(id => (
                        <button
                          key={id}
                          className={cat === id ? `${css.chip} ${css.on}` : css.chip}
                          onClick={() => setCat(id)}
                        >{(data.categories[id] && (data.categories[id]![lang] || data.categories[id]!.en)) || id}</button>
                      ))}
                    </div>
                    {plugins.length === 0
                      ? <div className={css.empty}>{t('empty')}</div>
                      : <div className={css.grid}>{plugins.map(pluginCard)}</div>}
                  </>
                )
          : tab === 'themes' && themeSnap !== null
            ? (
                <>
                  {/* Light/dark/system live in the official Appearance setting; this
                    tab only shows what that setting can't: registered third-party
                    palettes (none in the wild yet) and installable theme plugins. */}
                  {(() => {
                    const extra = themeSnap.themes.filter(def => def.id !== 'light' && def.id !== 'dark')
                    return extra.length > 0 && (
                      <div className={css.grid} style={{ marginBottom: 10 }}>
                        {extra.map(def => themeCard(def.id, def.id, themeSwatch(def)))}
                      </div>
                    )
                  })()}
                  {data === null
                    ? <div className={css.loading}><span className={css.spin} />{t('loading')}</div>
                    : themePlugins.length === 0
                      ? <div className={css.empty}>{t('themeEmpty')}</div>
                      : <div className={css.grid}>{themePlugins.map(themePluginCard)}</div>}
                </>
              )
            : Object.keys(installed).length === 0
              ? <div className={css.empty}>{t('installedEmpty')}</div>
              : Object.entries(installed).map(([name, spec]) => {
                  const entry = data === null ? undefined : data.plugins.find(p => p.name === name
                    || (repoOf(p.url) !== null && String(spec).toLowerCase().includes(('github:' + repoOf(p.url)).toLowerCase())))
                  const status = updates[name]
                  const version = status && status.version ? 'v' + status.version : ''
                  const specText = String(spec)
                  const ghSpec = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:#|$)/.exec(specText)
                  const repoUrl = entry !== undefined ? entry.url : ghSpec !== null ? 'https://github.com/' + ghSpec[1] : null
                  return (
                    <div key={name} className={css.irow}>
                      <div style={{ minWidth: 0 }}>
                        <div className={css.nm}>{name}{version && <span className={css.owner}>{' ' + version}</span>}</div>
                        {repoUrl !== null
                          ? <a className={`${css.spec} ${css.src}`} href={repoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>{specText}</a>
                          : <div className={css.spec}>{specText}</div>}
                        {entry !== undefined && (
                          <div className={css.desc} style={{ minHeight: 0 }}>
                            {(entry.description && (entry.description[lang] || entry.description.en)) || ''}
                          </div>
                        )}
                        {updatingName === name && (
                          <div className={css.progress} style={{ margin: '6px 0 0' }}>
                            <span className={css.spin} />
                            <code className={css.grow}>{progressLine || t('progressHint')}</code>
                          </div>
                        )}
                      </div>
                      <span className={css.grow} />
                      {repoUrl !== null && <a className={css.src} href={repoUrl + '#readme'} target="_blank" rel="noreferrer">{t('readme')}</a>}
                      {updatedNames.includes(name)
                        ? <button className={`${css.btn} ${css.done}`}>{t('updated')}</button>
                        : updatingName === name
                          ? <button className={`${css.btn} ${css.upd} ${css.busy}`}>{t('updating')}</button>
                          : status && status.updateAvailable
                            ? (
                                <button
                                  className={`${css.btn} ${css.upd}`}
                                  disabled={updatingName !== null}
                                  onClick={() => doUpdate(name)}
                                >{t('update')}</button>
                              )
                            : status && status.kind === 'linked'
                              ? <span className={css.owner}>{t('linkedDev')}</span>
                              : <span className={css.owner}>{t('upToDate')}</span>}
                      {name !== 'dsh-market' && name !== 'dshmarket' && (
                        removingName === name
                          ? <button className={`${css.btn} ${css.danger} ${css.busy}`}>{t('uninstalling')}</button>
                          : removeArmed === name
                            ? (
                                <button
                                  className={`${css.btn} ${css.danger} ${css.armed}`}
                                  onClick={() => doUninstall(name)}
                                  onMouseLeave={() => setRemoveArmed(null)}
                                >{t('confirmRemove')}</button>
                              )
                            : (
                                <button
                                  className={`${css.btn} ${css.danger}`}
                                  disabled={removingName !== null || busyUrl !== null || updatingName !== null}
                                  onClick={() => setRemoveArmed(name)}
                                >{t('uninstall')}</button>
                              )
                      )}
                    </div>
                  )
                })}
      </div>
      {showTop && (
        <button
          className={css.top}
          title={t('backTop')}
          onClick={() => { const el = bodyRef.current; if (el) el.scrollTo({ top: 0, behavior: 'smooth' }) }}
        >↑</button>
      )}
      {confirming !== null && (
        <div className={css.mask} onClick={e => { if (e.target === e.currentTarget) setConfirming(null) }}>
          <div className={css.modal}>
            <h3>{t('confirmTitle') + ' ' + confirming.name + '?'}</h3>
            <p>{(confirming.description && (confirming.description[lang] || confirming.description.en)) || ''}</p>
            <div className={css.cmd}>{confirming.install}</div>
            {looksTerminal(confirming, lang) && (
              <p style={{ color: 'var(--dsw-alias-state-warn-primary, #b45309)', fontWeight: 600 }}>
                {'🖥️ ' + t('terminalWarn') + ' '}
                <a className={css.src} href={confirming.url + '#readme'} target="_blank" rel="noreferrer">{t('readme')}</a>
              </p>
            )}
            <p>{'⚠️ ' + t('confirmWarn')}</p>
            <div className={css.acts}>
              <button className={`${css.btn} ${css.ghost}`} onClick={() => setConfirming(null)}>{t('cancel')}</button>
              <button className={`${css.btn} ${css.install}`} onClick={() => doInstall(confirming)}>{t('install')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
