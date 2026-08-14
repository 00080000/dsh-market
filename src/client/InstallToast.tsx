/**
 * Post-reload confirmation: a floating "installed and live" card in the
 * shell overlay layer, shown once after the refresh that follows a hot
 * install, so the user lands back in their flow with visible proof.
 */
import { useEffect, useState } from 'react'
import css from './Market.module.css'
import { readSession } from './market-data.ts'
import type { Translate } from './market-data.ts'

export function InstallToast(props: { t: Translate }) {
  const t = props.t
  const [mode] = useState(() => {
    const value = sessionStorage.getItem('dshm-toast-mode')
    sessionStorage.removeItem('dshm-toast-mode')
    return value
  })
  const [names, setNames] = useState<string[]>(() => {
    const value = readSession('dshm-toast')
    sessionStorage.removeItem('dshm-toast')
    return Array.isArray(value) ? value : []
  })
  useEffect(() => {
    if (names.length === 0) return
    const timer = setTimeout(() => setNames([]), 10000)
    return () => clearTimeout(timer)
  }, [names])
  if (names.length === 0) return null
  return (
    <div className={css.toast}>
      <span>✨</span>
      <span>{names.join(', ') + ' ' + t(mode === 'theme' ? 'toastTheme' : 'toastReady')}</span>
      <button className={`${css.btn} ${css.install}`} onClick={() => setNames([])}>{t('gotIt')}</button>
    </div>
  )
}
