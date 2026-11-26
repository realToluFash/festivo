import type { Freshness } from './serviceFreshness.ts';
import { ITEM_STATES, type ItemState, PLATE_STAGES, type PlateStage } from './serviceStages.ts';

/** sc-4005's writes that are kept on the device with no connection, sent in order, and checked by the API when they land. */
export const KEPT_TAPS = [
  'mark',
  'check',
  'takeOff',
  'takeToTable',
  'tick',
  'allServed',
  'sendBack',
  'choice',
  'itemState',
  'undo',
] as const;

export type KeptTap = (typeof KEPT_TAPS)[number];

/** Refused on the device with no connection, and never kept: each story that owns one builds its refusal. */
export const CONNECTION_TAPS = [
  'startTray',
  'flaggedTick',
  'pause',
  'giveTo',
  'queueChange',
  'teamMove',
  'requestAction',
] as const;

export type ConnectionTap = (typeof CONNECTION_TAPS)[number];

export type ServiceTapKind = KeptTap | ConnectionTap;

/** A tick on a guest with any flag, allergy or diet, is checked at the table on what is true now. */
export function tapKind(kind: KeptTap, guestFlagged = false): ServiceTapKind {
  return kind === 'tick' && guestFlagged ? 'flaggedTick' : kind;
}

function needsConnection(kind: ServiceTapKind): kind is ConnectionTap {
  return (CONNECTION_TAPS as readonly string[]).includes(kind);
}

export const NEEDS_CONNECTION_KEYS: Partial<Record<ConnectionTap, string>> = {
  startTray: 'service.needsConnection.startTray',
  flaggedTick: 'service.needsConnection.flaggedTick',
};

/** What a tap does now: sent, kept to send later, or refused while the device is No connection, with the key its story shows (null where that story has none yet). */
export function tapNow(
  kind: ServiceTapKind,
  freshness: Freshness,
): 'send' | 'keep' | { refused: string | null } {
  if (freshness.state !== 'noConnection') return 'send';
  if (needsConnection(kind)) return { refused: NEEDS_CONNECTION_KEYS[kind] ?? null };

  return 'keep';
}

export interface TapExpected {
  plates?: Record<string, PlateStage>;
  item?: ItemState;
}

export type TapRefusal =
  | {
      kind: 'stageNow';
      plateId: string;
      guestId: string;
      table: string;
      stage: PlateStage;
      by: string | null;
    }
  | { kind: 'offTray'; plateId: string; guestId: string; table: string; by: string | null }
  | { kind: 'itemNow'; item: string; state: ItemState; by: string | null }
  | { kind: 'trayNotYours'; name: string }
  | { kind: 'undoExpired' }
  | { kind: 'other'; title: string };

export const REFUSAL_KINDS = [
  'stageNow',
  'offTray',
  'itemNow',
  'trayNotYours',
  'undoExpired',
  'other',
] as const;

export interface TapProblem {
  type: string;
  title: string;
  changed?: unknown;
  waiter?: unknown;
}

const ERRORS = 'https://soirely.com/errors/';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Each plate or item the refusal names, as its own line; any other refusal is one line with its problem's title. */
export function tapRefusals(problem: TapProblem): TapRefusal[] {
  if (problem.type === `${ERRORS}tray_not_yours`) {
    const name = isRecord(problem.waiter) ? text(problem.waiter.name) : null;

    return name == null
      ? [{ kind: 'other', title: problem.title }]
      : [{ kind: 'trayNotYours', name }];
  }

  if (problem.type === `${ERRORS}undo_expired`) return [{ kind: 'undoExpired' }];

  if (problem.type !== `${ERRORS}service_changed` || !Array.isArray(problem.changed)) {
    return [{ kind: 'other', title: problem.title }];
  }

  const lines = problem.changed.flatMap((one): TapRefusal[] => {
    if (!isRecord(one)) return [];
    const by = text(one.by);
    const item = text(one.item);

    if (item != null && (ITEM_STATES as readonly unknown[]).includes(one.state)) {
      return [{ kind: 'itemNow', item, state: one.state as ItemState, by }];
    }

    const plateId = text(one.plateId);
    const guestId = text(one.guestId);
    const table = text(one.table);

    if (plateId == null || guestId == null || table == null) return [];
    if (one.onTray === false) return [{ kind: 'offTray', plateId, guestId, table, by }];
    if (!(PLATE_STAGES as readonly unknown[]).includes(one.stage)) return [];

    return [{ kind: 'stageNow', plateId, guestId, table, stage: one.stage as PlateStage, by }];
  });

  return lines.length === 0 ? [{ kind: 'other', title: problem.title }] : lines;
}

/** One key per stage and per item state, and one where no name came, so no word is joined into a sentence; slots {{who}}, {{item}}, {{by}}, {{name}}, and {{count}} for the minutes an undo had. */
export const NOT_SENT_KEYS = {
  heading: 'service.notSent.heading',
  stageNow: keysOf(PLATE_STAGES, 'service.notSent.stageNow'),
  stageNowUnnamed: keysOf(PLATE_STAGES, 'service.notSent.stageNowUnnamed'),
  offTray: 'service.notSent.offTray',
  offTrayUnnamed: 'service.notSent.offTrayUnnamed',
  itemNow: keysOf(ITEM_STATES, 'service.notSent.itemNow'),
  itemNowUnnamed: keysOf(ITEM_STATES, 'service.notSent.itemNowUnnamed'),
  trayNotYours: 'service.notSent.trayNotYours',
  undoExpired: 'service.notSent.undoExpired',
  waitingToSend: 'service.waitingToSend',
} as const;

export const UNDO_MINUTES = 2;

function keysOf<T extends string>(codes: readonly T[], prefix: string): Record<T, string> {
  return Object.fromEntries(codes.map((code) => [code, `${prefix}.${code}`])) as Record<T, string>;
}

/** The key of a refusal's line; an `other` line shows its problem's title as it came. */
export function refusalKey(refusal: TapRefusal): string | null {
  switch (refusal.kind) {
    case 'stageNow':
      return (refusal.by == null ? NOT_SENT_KEYS.stageNowUnnamed : NOT_SENT_KEYS.stageNow)[
        refusal.stage
      ];
    case 'offTray':
      return refusal.by == null ? NOT_SENT_KEYS.offTrayUnnamed : NOT_SENT_KEYS.offTray;
    case 'itemNow':
      return (refusal.by == null ? NOT_SENT_KEYS.itemNowUnnamed : NOT_SENT_KEYS.itemNow)[
        refusal.state
      ];
    case 'trayNotYours':
      return NOT_SENT_KEYS.trayNotYours;
    case 'undoExpired':
      return NOT_SENT_KEYS.undoExpired;
    case 'other':
      return null;
  }
}

/** A refused tap is dropped and the ones after it still go; a 5xx, a lapsed sign-in or no answer keeps it, and a 429 waits. */
export function tapOutcome(status: number | null): 'answered' | 'refused' | 'keep' | 'wait' {
  if (status == null || status >= 500 || status === 401) return 'keep';
  if (status === 429) return 'wait';
  if (status >= 400) return 'refused';

  return 'answered';
}
