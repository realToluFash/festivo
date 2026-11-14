import { READER_ZONE } from '../events/EventsSample.ts';
import { type GuestKey, READER, READER_NOW } from './MessagesSample.ts';
import { STOP, sayStop } from './MessagesWords.ts';

export type StopSave = 'stop' | 'letAgain';

export interface StopMark {
  by: string;
  at: string;
}

export interface Stopping {
  manage: boolean;
  stopped: Partial<Record<GuestKey, StopMark>>;
  menu: boolean;
  asking: boolean;
  saving: StopSave | null;
  failed: StopSave | null;
}

export const STOP_MS = 600;

export const OTHER_MEMBER = 'Tunde Bakare';

export const SEEDED_STOP: StopMark = { by: OTHER_MEMBER, at: '2026-11-02T20:15:00Z' };
export const LIVE_STOP: StopMark = { by: READER, at: READER_NOW };

export const STOP_STATES = [
  'stopAction',
  'stopAsk',
  'stopFailed',
  'stopped',
  'letAgainFailed',
  'stoppedNoManage',
] as const;

export type StopState = (typeof STOP_STATES)[number];

export const NO_STOPS: Stopping = {
  manage: true,
  stopped: {},
  menu: false,
  asking: false,
  saving: null,
  failed: null,
};

const INES_STOPPED = { ines: SEEDED_STOP };

const STARTS: Record<StopState, Stopping> = {
  stopAction: { ...NO_STOPS, menu: true },
  stopAsk: { ...NO_STOPS, asking: true },
  stopFailed: { ...NO_STOPS, asking: true, failed: 'stop' },
  stopped: { ...NO_STOPS, stopped: INES_STOPPED },
  letAgainFailed: { ...NO_STOPS, stopped: INES_STOPPED, failed: 'letAgain' },
  stoppedNoManage: { ...NO_STOPS, manage: false, stopped: INES_STOPPED },
};

export function isStopState(state: string | null): state is StopState {
  return STOP_STATES.some((one) => one === state);
}

export function stopStart(state: string | null): { stopping?: Stopping } {
  return isStopState(state) ? { stopping: STARTS[state] } : {};
}

export function stoppingOf(m: { stopping?: Stopping | undefined }): Stopping {
  return m.stopping ?? NO_STOPS;
}

/** Only a matched guest's conversation has the actions, and only for a member with messages.manage. */
export function hasActions(s: Stopping, key: GuestKey): boolean {
  return s.manage && key !== 'unknown';
}

/** What a conversation's head offers: without messages.manage, neither Done nor More actions. */
export function headOf(s: Stopping, key: GuestKey): 'none' | 'done' | 'doneAndMore' {
  if (!s.manage) return 'none';
  return hasActions(s, key) ? 'doneAndMore' : 'done';
}

export function itemLabel(s: Stopping, key: GuestKey, name: string): string {
  return s.stopped[key] == null ? sayStop.item(name) : STOP.letThemWriteAgain;
}

export function openActions(s: Stopping): Stopping {
  return s.manage ? { ...s, menu: true } : s;
}

export function closeActions(s: Stopping): Stopping {
  return { ...s, menu: false };
}

export function chooseItem(s: Stopping, key: GuestKey): Stopping {
  const closed = closeActions(s);
  if (closed.stopped[key] != null) return press(closed, 'letAgain');

  return { ...closed, asking: true, failed: null };
}

export function keepWriting(s: Stopping): Stopping {
  return s.saving == null ? { ...s, asking: false, failed: null } : s;
}

export function press(s: Stopping, save: StopSave): Stopping {
  return s.saving == null ? { ...s, saving: save, failed: null } : s;
}

/** The demo's save answers once STOP_MS has passed; `ok` false leaves the alert line and the way to press again. */
export function settled(
  s: Stopping,
  key: GuestKey,
  ok: boolean,
  mark: StopMark = LIVE_STOP,
): Stopping {
  const save = s.saving;
  if (save == null) return s;
  if (!ok) return { ...s, saving: null, failed: save };
  if (save === 'stop')
    return {
      ...s,
      saving: null,
      failed: null,
      asking: false,
      stopped: { ...s.stopped, [key]: mark },
    };
  const { [key]: _gone, ...stopped } = s.stopped;

  return { ...s, saving: null, failed: null, stopped };
}

export function stoppedLine(
  mark: StopMark,
  locale = 'en-US',
  timeZone: string = READER_ZONE,
): string {
  const at = new Date(mark.at);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(at);

  return mark.by === READER ? sayStop.youStopped(date) : sayStop.stopped(mark.by, date);
}
