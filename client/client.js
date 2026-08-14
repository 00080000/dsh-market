window.__ModuleLoader__.load({ id: "dsh-market", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
'use strict'

/**
 * dsh-market client: registers a "Market" settings section rendering the
 * plugin market UI. Hand-authored CJS bundle (no build step); the only
 * external is the loader module table's `react`.
 */

const React = require('react')
const h = React.createElement
const { useState, useEffect, useMemo, useCallback } = React

const NS = 'dsh-market'

const zh = {
  nav: '插件市场',
  subtitle: '发现社区为 DeepSeek Harness 打造的能力',
  searchPh: '搜索插件，比如：通知、终端、记忆…',
  tabDiscover: '发现',
  tabInstalled: '已安装',
  all: '全部',
  install: '安装',
  installing: '安装中…',
  installedBadge: '✓ 已装好',
  alreadyInstalled: '✓ 已安装',
  restartBanner: '个新插件已装好，重启 DeepSeek Harness 后就能用啦',
  restartHint: '重启方式：关闭当前 dsh 进程后重新运行（例如 dsh web）',
  confirmTitle: '安装',
  confirmWarn: '插件是社区第三方代码。安装即表示你信任该来源；构建脚本默认被禁止执行。',
  cancel: '取消',
  empty: '没有匹配的插件',
  installedEmpty: '还没有装过社区插件，去「发现」页逛逛吧',
  loadFail: '插件目录加载失败，请稍后重试',
  installFail: '安装失败',
  viewSource: '源码',
}

const en = {
  nav: 'Plugin Market',
  subtitle: 'Discover community plugins for DeepSeek Harness',
  searchPh: 'Search plugins: notify, terminal, memory…',
  tabDiscover: 'Discover',
  tabInstalled: 'Installed',
  all: 'All',
  install: 'Install',
  installing: 'Installing…',
  installedBadge: '✓ Installed',
  alreadyInstalled: '✓ Installed',
  restartBanner: 'new plugin(s) installed — restart DeepSeek Harness to activate',
  restartHint: 'To restart: stop the current dsh process and run it again (e.g. dsh web)',
  confirmTitle: 'Install',
  confirmWarn: 'Plugins are third-party community code. Installing means you trust this source; build scripts are blocked by default.',
  cancel: 'Cancel',
  empty: 'No plugins match',
  installedEmpty: 'No community plugins yet — browse the Discover tab',
  loadFail: 'Failed to load the plugin catalog, please retry later',
  installFail: 'Install failed',
  viewSource: 'Source',
}

const CSS = `
.dshm-root{height:100%;display:flex;flex-direction:column;min-width:0;color:var(--dsw-alias-label-primary,#1f2328)}
.dshm-head{padding:4px 4px 12px}
.dshm-title{font-size:16px;font-weight:700;margin:0}
.dshm-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);margin-top:2px}
.dshm-search{margin-top:12px}
.dshm-search input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:8px;padding:8px 12px;font-size:13px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;outline:none}
.dshm-search input:focus{border-color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dshm-tabs{display:flex;gap:2px;margin-top:10px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}
.dshm-tab{border:none;background:none;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,#6b7280);padding:7px 12px;cursor:pointer;border-bottom:2px solid transparent}
.dshm-tab.on{color:var(--dsw-alias-brand-primary,#4f6ef7);border-bottom-color:var(--dsw-alias-brand-primary,#4f6ef7);font-weight:600}
.dshm-restart{display:flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-layer-2,#fdf3e3);border:1px solid var(--dsw-alias-border-l1,#f3e3c3);border-radius:8px;padding:8px 12px;font-size:12px;margin:10px 4px 0}
.dshm-body{flex:1;overflow-y:auto;padding:12px 4px 24px}
.dshm-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.dshm-chip{font:inherit;font-size:12px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:99px;padding:3px 11px;cursor:pointer;color:var(--dsw-alias-label-secondary,#6b7280)}
.dshm-chip.on{background:var(--dsw-alias-brand-primary,#4f6ef7);border-color:var(--dsw-alias-brand-primary,#4f6ef7);color:#fff}
.dshm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.dshm-card{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.dshm-row1{display:flex;align-items:center;gap:9px;min-width:0}
.dshm-av{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0}
.dshm-nm{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshm-owner{font-size:11px;color:var(--dsw-alias-label-secondary,#9ca3af)}
.dshm-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);line-height:1.55;min-height:2.4em}
.dshm-foot{display:flex;align-items:center;gap:8px;margin-top:2px}
.dshm-cat{font-size:10px;color:var(--dsw-alias-label-secondary,#9ca3af);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:99px;padding:1px 8px}
.dshm-grow{flex:1}
.dshm-src{font-size:11px;color:var(--dsw-alias-label-secondary,#9ca3af);text-decoration:none}
.dshm-src:hover{color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dshm-btn{border:none;border-radius:7px;padding:5px 14px;font:inherit;font-size:12px;cursor:pointer;font-weight:600}
.dshm-btn.install{background:var(--dsw-alias-brand-primary,#4f6ef7);color:#fff}
.dshm-btn.busy{opacity:.65;cursor:default}
.dshm-btn.done{background:transparent;color:var(--dsw-alias-state-success-primary,#16a34a);cursor:default}
.dshm-btn.ghost{background:var(--dsw-alias-bg-layer-2,#f3f4f6);color:var(--dsw-alias-label-secondary,#6b7280)}
.dshm-empty{color:var(--dsw-alias-label-secondary,#9ca3af);font-size:13px;padding:32px;text-align:center}
.dshm-err{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:12px;margin:8px 0;white-space:pre-wrap;word-break:break-all}
.dshm-mask{position:fixed;inset:0;background:rgba(15,18,25,.4);display:flex;align-items:center;justify-content:center;z-index:1000}
.dshm-modal{width:min(400px,90%);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:14px;padding:18px 20px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
.dshm-modal h3{font-size:14px;margin:0 0 8px}
.dshm-modal p{font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);line-height:1.6;margin:4px 0}
.dshm-cmd{font-size:11px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);border-radius:6px;padding:6px 9px;font-family:ui-monospace,Menlo,monospace;margin:8px 0;word-break:break-all}
.dshm-acts{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.dshm-irow{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:8px}
.dshm-spec{font-size:11px;color:var(--dsw-alias-label-secondary,#9ca3af);font-family:ui-monospace,Menlo,monospace}
`

function injectStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-market/market"]') !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-market'
  tag.dataset.pluginCss = 'dsh-market/market'
  tag.textContent = CSS
  document.head.appendChild(tag)
}

function isZh() {
  const lang = document.documentElement.lang || navigator.language || 'en'
  return lang.toLowerCase().startsWith('zh')
}

function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return 'hsl(' + (((hash % 360) + 360) % 360) + ' 55% 52%)'
}

function repoOf(url) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/.exec(url)
  return m ? m[1] : null
}

/** A registry plugin counts as installed when its package name or GitHub spec appears in the profile dependencies. */
function isInstalled(plugin, installed) {
  if (installed[plugin.name] !== undefined) return true
  const repo = repoOf(plugin.url)
  if (repo === null) return false
  const needle = ('github:' + repo).toLowerCase()
  return Object.values(installed).some(spec => String(spec).toLowerCase().includes(needle))
}

function MarketSection(props) {
  const t = props.t
  const lang = isZh() ? 'zh' : 'en'
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [installed, setInstalled] = useState({})
  const [tab, setTab] = useState('discover')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [confirming, setConfirming] = useState(null)
  const [busyUrl, setBusyUrl] = useState(null)
  const [doneUrls, setDoneUrls] = useState([])
  const [installError, setInstallError] = useState(null)

  useEffect(() => {
    injectStyles()
    fetch('/dsh-market/registry', { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
      .then(body => setData(body.registry))
      .catch(() => setLoadError(true))
    refreshInstalled()
  }, [])

  const refreshInstalled = useCallback(() => {
    fetch('/dsh-market/installed', { cache: 'no-store' })
      .then(res => res.json())
      .then(body => setInstalled(body.installed || {}))
      .catch(() => {})
  }, [])

  const plugins = useMemo(() => {
    if (data === null) return []
    const query = q.trim().toLowerCase()
    return data.plugins.filter(p => {
      if (cat !== 'all' && p.category !== cat) return false
      if (query === '') return true
      const desc = (p.description && (p.description[lang] || p.description.en)) || ''
      return p.name.toLowerCase().includes(query)
        || p.owner.toLowerCase().includes(query)
        || desc.toLowerCase().includes(query)
    })
  }, [data, q, cat, lang])

  const doInstall = useCallback((plugin) => {
    setConfirming(null)
    setInstallError(null)
    setBusyUrl(plugin.url)
    fetch('/dsh-market/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: plugin.url }),
    })
      .then(res => res.json().then(body => ({ status: res.status, body })))
      .then(({ status, body }) => {
        if (status === 200 && body.ok) {
          setDoneUrls(urls => urls.concat(plugin.url))
          refreshInstalled()
        } else {
          const text = v => typeof v === 'string' ? v : (v && typeof v.text === 'string') ? v.text : v == null ? '' : JSON.stringify(v)
          const detail = text(body.error) || text(body.stderr) || text(body.stdout) || ('exit ' + body.exitCode)
          setInstallError(t('installFail') + ': ' + plugin.name + ' — ' + detail.trim().slice(-600))
        }
      })
      .catch(error => setInstallError(t('installFail') + ': ' + String(error)))
      .finally(() => setBusyUrl(null))
  }, [refreshInstalled, t])

  const categories = data === null ? [] : Object.keys(data.categories)

  return h('div', { className: 'dshm-root' },
    h('div', { className: 'dshm-head' },
      h('h2', { className: 'dshm-title' }, t('nav')),
      h('div', { className: 'dshm-sub' }, t('subtitle') + (data ? ' · ' + data.count : '')),
      h('div', { className: 'dshm-search' },
        h('input', { placeholder: t('searchPh'), value: q, onChange: e => setQ(e.target.value) })),
      h('div', { className: 'dshm-tabs' },
        h('button', { className: 'dshm-tab' + (tab === 'discover' ? ' on' : ''), onClick: () => setTab('discover') }, t('tabDiscover')),
        h('button', { className: 'dshm-tab' + (tab === 'installed' ? ' on' : ''), onClick: () => { setTab('installed'); refreshInstalled() } },
          t('tabInstalled') + (Object.keys(installed).length > 0 ? ' (' + Object.keys(installed).length + ')' : ''))),
      doneUrls.length > 0 && h('div', { className: 'dshm-restart' },
        h('span', null, '🔄'),
        h('span', { className: 'dshm-grow' }, h('b', null, doneUrls.length), ' ', t('restartBanner')),
        h('span', { title: t('restartHint') }, 'ℹ️'))),
    installError !== null && h('div', { className: 'dshm-err' }, installError),
    h('div', { className: 'dshm-body' },
      tab === 'discover'
        ? loadError
          ? h('div', { className: 'dshm-empty' }, t('loadFail'))
          : data === null
            ? h('div', { className: 'dshm-empty' }, '…')
            : h(React.Fragment, null,
                h('div', { className: 'dshm-cats' },
                  h('button', { className: 'dshm-chip' + (cat === 'all' ? ' on' : ''), onClick: () => setCat('all') }, t('all')),
                  categories.map(id => h('button', {
                    key: id,
                    className: 'dshm-chip' + (cat === id ? ' on' : ''),
                    onClick: () => setCat(id),
                  }, (data.categories[id] && (data.categories[id][lang] || data.categories[id].en)) || id))),
                plugins.length === 0
                  ? h('div', { className: 'dshm-empty' }, t('empty'))
                  : h('div', { className: 'dshm-grid' }, plugins.map(p => {
                      const desc = (p.description && (p.description[lang] || p.description.en)) || ''
                      const done = doneUrls.includes(p.url)
                      const already = isInstalled(p, installed)
                      const busy = busyUrl === p.url
                      return h('div', { key: p.url, className: 'dshm-card' },
                        h('div', { className: 'dshm-row1' },
                          h('div', { className: 'dshm-av', style: { background: avatarColor(p.name) } },
                            p.name.replace(/^dsh[-_]/i, '').charAt(0).toUpperCase() || 'P'),
                          h('div', { style: { minWidth: 0 } },
                            h('div', { className: 'dshm-nm' }, p.name),
                            h('div', { className: 'dshm-owner' }, p.owner))),
                        h('div', { className: 'dshm-desc' }, desc),
                        h('div', { className: 'dshm-foot' },
                          h('span', { className: 'dshm-cat' },
                            (data.categories[p.category] && (data.categories[p.category][lang] || data.categories[p.category].en)) || p.category),
                          h('a', { className: 'dshm-src', href: p.url, target: '_blank', rel: 'noreferrer' }, t('viewSource')),
                          h('span', { className: 'dshm-grow' }),
                          done
                            ? h('button', { className: 'dshm-btn done' }, t('installedBadge'))
                            : already
                              ? h('button', { className: 'dshm-btn done' }, t('alreadyInstalled'))
                              : busy
                                ? h('button', { className: 'dshm-btn install busy' }, t('installing'))
                                : h('button', {
                                    className: 'dshm-btn install',
                                    disabled: busyUrl !== null,
                                    onClick: () => setConfirming(p),
                                  }, t('install'))))
                    })))
        : Object.keys(installed).length === 0
          ? h('div', { className: 'dshm-empty' }, t('installedEmpty'))
          : Object.entries(installed).map(([name, spec]) => {
              const entry = data === null ? undefined : data.plugins.find(p => p.name === name
                || (repoOf(p.url) !== null && String(spec).toLowerCase().includes(('github:' + repoOf(p.url)).toLowerCase())))
              return h('div', { key: name, className: 'dshm-irow' },
                h('div', { style: { minWidth: 0 } },
                  h('div', { className: 'dshm-nm' }, name),
                  h('div', { className: 'dshm-spec' }, String(spec)),
                  entry !== undefined && h('div', { className: 'dshm-desc', style: { minHeight: 0 } },
                    (entry.description && (entry.description[lang] || entry.description.en)) || '')),
                h('span', { className: 'dshm-grow' }),
                entry !== undefined && h('a', { className: 'dshm-src', href: entry.url, target: '_blank', rel: 'noreferrer' }, t('viewSource')))
            })),
    confirming !== null && h('div', { className: 'dshm-mask', onClick: e => { if (e.target === e.currentTarget) setConfirming(null) } },
      h('div', { className: 'dshm-modal' },
        h('h3', null, t('confirmTitle') + ' ' + confirming.name + '?'),
        h('p', null, (confirming.description && (confirming.description[lang] || confirming.description.en)) || ''),
        h('div', { className: 'dshm-cmd' }, confirming.install),
        h('p', null, '⚠️ ' + t('confirmWarn')),
        h('div', { className: 'dshm-acts' },
          h('button', { className: 'dshm-btn ghost', onClick: () => setConfirming(null) }, t('cancel')),
          h('button', { className: 'dshm-btn install', onClick: () => doInstall(confirming) }, t('install'))))))
}

exports.name = 'dsh-market'
exports.inject = ['slots', 'locale']
exports.apply = function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-market: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'market',
    order: 40,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t }),
  }, () => h(MarketSection, { t })))
}

return module.exports; } });
