/**
 * The activity entry and its panel: every install, update and uninstall the
 * user started, with the action each outcome calls for.
 *
 * The entry lives in the tab row rather than above the plugin grid, so
 * paginating, searching or switching tab cannot take a record — or a pending
 * decision — off screen. It reports the batch as one aggregate ("installing
 * 3 / 7") instead of one line per plugin.
 */

import {
  Button,
  IconCheckOutline16,
  IconCodeOutline16,
  IconLoadingOutline16,
  IconWarningOutline16,
  DisclosureRow,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import css from './Market.module.css'
import type { Translate } from './market-data.ts'
import type { ConflictGroup, OperationRecord } from './operations.ts'
import { bucketOf, isSettled, needsUser, queuePosition, sortForPanel, summarize } from './operations.ts'

/** What the two clash outcomes are, in the order they are offered. */
const CHOICES = [
  { id: 'keep' as const, label: 'conflictKeep', note: 'conflictKeepNote' },
  { id: 'swap' as const, label: 'conflictSwap', note: 'conflictSwapNote' },
]

export interface OperationsPanelProps {
  t: Translate
  records: readonly OperationRecord[]
  open: boolean
  /** Owned by the parent: a card's "cannot install" marker raises the panel. */
  onOpenChange: (open: boolean) => void
  /** True while a swap is running, which disables both clash outcomes. */
  replacing: boolean
  /** Blocks the destructive outcome when pnpm is not usable yet. */
  envReady: boolean
  onClearSettled: () => void
  onCancel: (record: OperationRecord) => void
  onDismiss: (record: OperationRecord) => void
  onRefresh: () => void
  /** Resolve a clash: keep what is installed, or uninstall it and retry. */
  onResolveConflict: (record: OperationRecord, choice: 'keep' | 'swap') => void
  /** Retry an operation the host refused for a fixable reason. */
  onRetry?: ((record: OperationRecord) => void) | undefined
}

/** The clash roster: one row per installed owner, its ids beside it. */
function Roster(props: { groups: readonly ConflictGroup[] }) {
  return (
    <div className={css.roster}>
      {props.groups.map(group => (
        <div key={group.owner} className={css.rosterRow}>
          <span className={css.rosterName} title={group.owner}>{group.owner}</span>
          <span className={css.rosterIds}>{group.ids.join(', ')}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The decision attached to a clash. Two outcomes rather than an error plus a
 * destructive button: the default changes nothing, and selecting the other
 * one is itself the consent step, so its cost is stated here.
 */
function ConflictChoice(props: {
  t: Translate
  record: OperationRecord
  replacing: boolean
  envReady: boolean
  onResolve: (choice: 'keep' | 'swap') => void
}) {
  const { t, record, replacing, envReady } = props
  const [choice, setChoice] = useState<'keep' | 'swap'>('keep')
  const [whyOpen, setWhyOpen] = useState(false)
  return (
    <div className={css.opDecision}>
      <p className={css.conflictBody}>{t('conflictBody')}</p>
      <Roster groups={record.conflicts ?? []} />
      <p className={css.reassure}>
        <IconCheckOutline16 size={13} className={css.reassureOk} />
        {t('conflictReverted')}
      </p>
      <div className={css.choices} role="radiogroup">
        {CHOICES.map(({ id, label, note }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={choice === id}
            disabled={replacing}
            className={choice === id ? `${css.choice} ${css.choiceOn}` : css.choice}
            onClick={() => setChoice(id)}
          >
            <span className={choice === id ? `${css.radio} ${css.radioOn}` : css.radio} />
            <span className={css.choiceMain}>
              <span className={css.choiceTitle}>{t(label)}</span>
              <span className={id === 'keep' ? `${css.choiceNote} ${css.choiceSafe}` : css.choiceNote}>
                {t(note)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className={css.opDecisionFoot}>
        <Button
          variant={choice === 'swap' ? 'outline' : 'primary'}
          size="sm"
          className={choice === 'swap' ? css.dangerBtn : undefined}
          disabled={replacing || (choice === 'swap' && !envReady)}
          onClick={() => props.onResolve(choice)}
        >{replacing ? t('conflictReplacing') : t('confirm')}</Button>
      </div>
      <DisclosureRow
        icon={<IconCodeOutline16 size={16} />}
        title={t('conflictDetails')}
        open={whyOpen}
        expandable
        expandOnRowClick
        onToggle={() => setWhyOpen(open => !open)}
      >
        <div className={css.conflictWhy}>{t('conflictWhy')}</div>
      </DisclosureRow>
    </div>
  )
}

/** Icon for a record's visual bucket — three, not one per state. */
function BucketIcon(props: { record: OperationRecord }) {
  const bucket = bucketOf(props.record.state)
  if (bucket === 'busy') {
    return props.record.state === 'running'
      ? <span className={css.spin}><IconLoadingOutline16 size={13} /></span>
      : <span className={css.opQueuedIcon}>⋯</span>
  }
  if (bucket === 'ok') return <IconCheckOutline16 size={13} className={css.reassureOk} />
  return <IconWarningOutline16 size={14} className={css.conflictIcon} />
}

/** The one-line status under a record's name; the bucket carries the rest. */
function statusLine(t: Translate, record: OperationRecord, ahead: number | null): string {
  switch (record.state) {
    case 'queued':
      return ahead === null || ahead === 0 ? t('opQueued') : `${t('opQueued')} · ${t('opQueuedAhead')} ${String(ahead)}`
    case 'running':
      return record.detail ?? t('opRunning')
    case 'input':
      return t('opNeedsChoice')
    case 'failed':
      return record.reason ?? t('installFail')
    case 'warned':
      return record.reason ?? t('opDone')
    case 'done':
      return record.needsRefresh === true ? t('opDoneRefresh') : t('opDone')
  }
}

export function OperationsPanel(props: OperationsPanelProps) {
  const { t, records, open } = props
  const setOpen = props.onOpenChange
  const summary = summarize(records)
  const busy = summary.running + summary.queued > 0

  // The entry label is the batch, not a verb with no object: a bare "3" says
  // nothing about what is happening to the profile.
  const label = busy
    ? `${t('opInstalling')} ${String(summary.progressed)}/${String(summary.total)}`
    : summary.attention > 0
      ? `${String(summary.attention)} ${t('opNeedsYou')}`
      : t('opTitle')

  if (records.length === 0 && !open) {
    return (
      <button type="button" className={`${css.opEntry} ${css.opEntryQuiet}`} onClick={() => setOpen(true)}>
        {t('opTitle')}
      </button>
    )
  }

  return (
    <div className={css.opWrap}>
      <button
        type="button"
        className={summary.attention > 0 ? `${css.opEntry} ${css.opEntryAlert}` : css.opEntry}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {busy && <span className={css.spin}><IconLoadingOutline16 size={12} /></span>}
        {label}
        {summary.attention > 0 && <span className={css.opDot} />}
      </button>
      {open && (
        <div className={css.opPanel}>
          <div className={css.opHead}>
            <span className={css.opPanelTitle}>{t('opTitle')}</span>
            <span className={css.grow} />
            {summary.settled > 0 && (
              <Button variant="ghost" size="sm" onClick={props.onClearSettled}>{t('opClear')}</Button>
            )}
          </div>
          {busy && (
            <div className={css.opAggregate}>
              <div className={css.opAggregateTop}>
                <span>{t('opInstalling')} {summary.progressed}/{summary.total}</span>
              </div>
              <div className={css.bar}>
                <div
                  className={css.barFill}
                  style={{ width: `${String(Math.round(summary.progressed / Math.max(1, summary.total) * 100))}%` }}
                />
              </div>
              {/* Long installs are the norm; saying so is what makes leaving
                  the page an option rather than a gamble. */}
              <div className={css.opAggregateHint}>{t('opLeaveHint')}</div>
            </div>
          )}
          {records.length === 0 && (
            <div className={css.opEmpty}>
              {t('opEmpty')}
              <div className={css.opEmptyHint}>{t('opEmptyHint')}</div>
            </div>
          )}
          {sortForPanel(records).map((record) => {
            const ahead = queuePosition(records, record.id)
            return (
              <div key={record.id} className={needsUser(record) ? `${css.opRow} ${css.opRowAlert}` : css.opRow}>
                <span className={css.opIcon}><BucketIcon record={record} /></span>
                <div className={css.opMain}>
                  <div className={css.opTop}>
                    <span className={css.opVerb}>{t(`opKind_${record.kind}`)}</span>
                    <span className={css.opName} title={record.name}>{record.name}</span>
                  </div>
                  {record.state === 'running' && typeof record.percent === 'number' && (
                    <div className={css.bar}>
                      <div className={css.barFill} style={{ width: `${String(record.percent)}%` }} />
                    </div>
                  )}
                  <div className={bucketOf(record.state) === 'attention' ? `${css.opStatus} ${css.opStatusBad}` : css.opStatus}>
                    {statusLine(t, record, ahead)}
                  </div>
                  {needsUser(record) && (
                    <ConflictChoice
                      t={t}
                      record={record}
                      replacing={props.replacing}
                      envReady={props.envReady}
                      onResolve={choice => props.onResolveConflict(record, choice)}
                    />
                  )}
                </div>
                <div className={css.opActions}>
                  {record.state === 'running' && (
                    <Button variant="outline" size="sm" onClick={() => props.onCancel(record)}>{t('cancelOp')}</Button>
                  )}
                  {record.state === 'queued' && (
                    <Button variant="ghost" size="sm" onClick={() => props.onDismiss(record)}>{t('opDequeue')}</Button>
                  )}
                  {record.state === 'done' && record.needsRefresh === true && (
                    <Button variant="primary" size="sm" onClick={props.onRefresh}>{t('refresh')}</Button>
                  )}
                  {record.state === 'failed' && props.onRetry !== undefined && (
                    <Button variant="outline" size="sm" onClick={() => props.onRetry?.(record)}>{t('opRetry')}</Button>
                  )}
                  {isSettled(record) && (
                    <Button variant="ghost" size="sm" onClick={() => props.onDismiss(record)}>{t('dismissNotice')}</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
