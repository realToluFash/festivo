import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  type MakeLiveRow,
  type Translate,
  makeLiveRow,
  needsHost,
  rereadOf,
} from '@soirely/domain';

/** The word each phase shows, never the stored state and never its colour alone (WCAG 2.2 §1.4.1). */
export const PHASE_WORD = {
  draft: 'eventsScreen.draft',
  live: 'eventsScreen.live',
  happening_now: 'eventsScreen.happeningNow',
  paused: 'eventsScreen.paused',
  finished: 'eventsScreen.finished',
} as const satisfies Record<EventPhase, string>;

export interface DraftRow {
  line: MakeLiveRow['line'];
  offersMakeLive: boolean;
}

/** The row `/event-states.json` gives the event (sc-3584); Make live only to someone who manages it. `now` is the corrected clock's. */
export function draftRowOf(
  event: Pick<OrganisationEvent, 'status' | 'startsAt' | 'endsAt'>,
  now: Date,
  manages: boolean,
): DraftRow | null {
  const row = makeLiveRow(event, now, true);

  return row == null ? null : { line: row.line, offersMakeLive: manages && row.makeLive };
}

/** The read as the sheet opened already differs from the page, so the sheet says what it found instead of saving (sc-22143). Once this sheet's own save has gone through the page has its host, and a retry only goes live. */
export function changedSinceOpening(
  shown: Pick<OrganisationEvent, 'status' | 'hosts'>,
  opened: Pick<OrganisationEvent, 'status' | 'hosts'>,
): boolean {
  return needsHost(shown) && rereadOf(opened) !== 'noHost';
}

export type MakeLiveRefusal =
  { kind: 'concluded' } | { kind: 'planLimit'; plan: string; limit: number } | { kind: 'failed' };

/** Going live refused once any host is saved; somebody else's change is the shared step's `stale` (sc-22143). `concluded` reads the event again. */
export function refusalOf(error: unknown): MakeLiveRefusal {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.is('event_concluded')) return { kind: 'concluded' };
  if (error.is('plan_limit')) {
    return { kind: 'planLimit', plan: error.problem.plan ?? '', limit: error.problem.limit ?? 0 };
  }

  return { kind: 'failed' };
}

/** Make live's alert in words: the question, a refusal in its place, or what the demo offers after it (sc-3971). */
export interface LiveAlert {
  /** Which alert it is; a new one takes focus on its title. */
  turn: string;
  title: string;
  line: string;
  alert: boolean;
  failed: string | null;
  host: { label: string; help: string; error: string | null } | null;
  /** Who hosts it now, one per line, when somebody else gave it a host meanwhile. */
  hostsNow: { line: string; names: readonly string[] } | null;
  reason: string | null;
  later: string | null;
  failedLast: string | null;
  keep: { label: string; off: boolean };
  confirm: { label: string; busy: string | undefined } | null;
}

/** `askHost` while the draft had no host when it opened; `notice` is what a reread found (sc-22143). */
export interface LiveQuestion {
  kind: 'confirm';
  askHost: boolean;
  typed: string;
  error: string | null;
  notice: 'stillNoHost' | 'nowHosted' | null;
  pending: boolean;
  failed: boolean;
}

/** A refusal, or somebody else's change, said in the question's place with Close. */
export interface LiveTold {
  kind: 'told';
  title: string;
  line: string;
  changeDates: boolean;
}

export type LiveAsking = LiveQuestion | LiveTold;

/** What a refusal says in the question's place; a plain failure is null, said under the question. */
export function toldOf(refusal: MakeLiveRefusal, t: Translate): LiveTold | null {
  switch (refusal.kind) {
    case 'planLimit':
      return {
        kind: 'told',
        title: t('eventLive.planLimit', { plan: refusal.plan, count: refusal.limit }),
        line: t('eventLive.planLimitStays'),
        changeDates: false,
      };
    case 'concluded':
      return {
        kind: 'told',
        title: t('eventLive.notMadeLive'),
        line: t('eventLive.endPassed'),
        changeDates: true,
      };
    case 'failed':
      return null;
  }
}

const PLAIN = { reason: null, later: null, failedLast: null } as const;

/** The demo's alert for where Make live is: `makeLive` and its host states, or `makeLiveEndPassed`, `makeLivePlanLimit` and `makeLiveChanged`. */
export function liveAlertOf(
  asking: LiveAsking | null,
  event: Pick<OrganisationEvent, 'name' | 'hosts'>,
  t: Translate,
  changesDates: boolean,
): LiveAlert | null {
  if (asking == null) return null;
  if (asking.kind === 'told')
    return {
      ...PLAIN,
      turn: 'told',
      title: asking.title,
      line: asking.line,
      alert: true,
      failed: null,
      host: null,
      hostsNow: null,
      keep: { label: t('eventLive.close'), off: false },
      confirm:
        asking.changeDates && changesDates
          ? { label: t('eventLive.changeDates'), busy: undefined }
          : null,
    };

  const hostLabel = t('eventHosts.label', { position: 1 });

  return {
    ...PLAIN,
    turn: 'question',
    title: t('eventLive.confirmTitle', { name: event.name }),
    line: t('eventLive.confirmLine'),
    alert: false,
    failed: asking.failed
      ? t('eventLive.failed')
      : asking.notice === 'stillNoHost'
        ? t('eventEdit.changedElsewhere')
        : asking.notice === 'nowHosted'
          ? t('eventLive.notSavedChanged')
          : null,
    host: asking.askHost
      ? { label: hostLabel, help: t('eventLive.hostExplainer'), error: asking.error }
      : null,
    hostsNow:
      asking.notice === 'nowHosted' ? { line: t('eventLive.hostsNow'), names: event.hosts } : null,
    keep: { label: t('eventLive.notYet'), off: asking.pending },
    confirm: {
      label: t('eventLive.makeLive'),
      busy: asking.pending ? t('eventLive.making') : undefined,
    },
  };
}

export type EndRefusal = { kind: 'changed' } | { kind: 'concluded' } | { kind: 'failed' };

/** End now's refusals (sc-3585): `changed` and `concluded` read the event again. */
export function endRefusalOf(error: unknown): EndRefusal {
  if (error instanceof ApiError && error.is('event_state_invalid')) return { kind: 'changed' };
  if (error instanceof ApiError && error.is('event_concluded')) return { kind: 'concluded' };

  return { kind: 'failed' };
}

export type PauseRefusal = { kind: 'changed' } | { kind: 'failed' };

/** Pause's and Resume's refusals (sc-3586): only `changed`, which reads the event again; past the end the phase is Finished, so neither meets `event_concluded`. */
export function pauseRefusalOf(error: unknown): PauseRefusal {
  if (error instanceof ApiError && error.is('event_state_invalid')) return { kind: 'changed' };

  return { kind: 'failed' };
}
