import { demoWords } from './demoWords.ts';
import { SW } from './messagesStopWords.ts';

export { SW };

const sw = demoWords(SW);

export const STOP_GROUP = 'Stop writing from their page (sc-3978)';

export const STOP_STATES = [
  { key: 'stopAction', name: 'The conversation’s actions, open' },
  { key: 'stopAsk', name: 'Stop writing from their page, asked' },
  { key: 'stopFailed', name: 'Stop writing, not saved' },
  { key: 'stopped', name: 'Stopped writing from their page' },
  { key: 'letAgainFailed', name: 'Let them write again, not saved' },
  { key: 'stoppedNoManage', name: 'Stopped, without messages.manage' },
] as const;

export type StopState = (typeof STOP_STATES)[number]['key'];

export const STOP_MS = 600;
export const STOPPED_AT = '2026-11-02T20:15:00Z';
export const OTHER_MEMBER = 'Tunde Bakare';
export const STOP_ZONE = 'Europe/London';

export interface Stop {
  by: string;
  at: string;
}

export function isStopState(state: string | null): state is StopState {
  return STOP_STATES.some((one) => one.key === state);
}

export function stoppedLine(
  stop: Stop,
  reader: string,
  locale = 'en-US',
  timeZone = STOP_ZONE,
): string {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(stop.at));

  return stop.by === reader
    ? sw.filled(SW.youStoppedLine, { date })
    : sw.filled(SW.stoppedLine, { member: stop.by, date });
}

export function stopItem(guest: string, stopped: boolean): string {
  return stopped ? SW.letAgain : sw.filled(SW.stopItem, { guest });
}

export const stopTitle = (guest: string): string => sw.filled(SW.stopTitle, { guest });
export const letAgainSaid = (guest: string): string => sw.filled(SW.letAgainSaid, { guest });

export type Saving = 'idle' | 'busy' | 'failed';

export interface StopFlow {
  menu: boolean;
  ask: Saving | 'closed';
  letting: Saving;
}

export type StopEvent =
  | 'openMenu'
  | 'closeMenu'
  | 'pickStop'
  | 'keep'
  | 'go'
  | 'stopSaved'
  | 'stopRefused'
  | 'letGo'
  | 'letSaved'
  | 'letRefused';

export const IDLE: StopFlow = { menu: false, ask: 'closed', letting: 'idle' };

export function stopFlowOf(state: string | null): StopFlow {
  switch (state) {
    case 'stopAction':
      return { ...IDLE, menu: true };
    case 'stopAsk':
      return { ...IDLE, ask: 'idle' };
    case 'stopFailed':
      return { ...IDLE, ask: 'failed' };
    case 'letAgainFailed':
      return { ...IDLE, letting: 'failed' };
    default:
      return IDLE;
  }
}

/** The stop's one confirm and Let them write again's none: a press while busy is ignored, a refusal keeps what was there. */
export function stopFlowAfter(flow: StopFlow, event: StopEvent): StopFlow {
  const busy = flow.ask === 'busy' || flow.letting === 'busy';

  switch (event) {
    case 'openMenu':
      return busy ? flow : { ...flow, menu: true };
    case 'closeMenu':
      return { ...flow, menu: false };
    case 'pickStop':
      return { ...flow, menu: false, ask: 'idle' };
    case 'keep':
      return flow.ask === 'busy' ? flow : { ...flow, ask: 'closed' };
    case 'go':
      return flow.ask === 'idle' || flow.ask === 'failed' ? { ...flow, ask: 'busy' } : flow;
    case 'stopSaved':
      return { ...flow, ask: 'closed', letting: 'idle' };
    case 'stopRefused':
      return { ...flow, ask: 'failed' };
    case 'letGo':
      return busy ? flow : { ...flow, menu: false, letting: 'busy' };
    case 'letSaved':
      return { ...flow, letting: 'idle' };
    case 'letRefused':
      return { ...flow, letting: 'failed' };
  }
}
