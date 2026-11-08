import { doorPeople } from './GuestsModel.ts';
import { GUESTS, READER } from './GuestsSample.ts';
import type { ReplyKind } from './GuestsWords.ts';

/** sc-1301's scanner, by guests-a-spec §19's ?state=: each result the boards draw. */
export const SCAN_STATES = [
  'scanning',
  'valid',
  'arrivedFromScan',
  'validHeld',
  'alreadyArrived',
  'notComingNow',
  'notOnList',
  'offline',
  'offlineNotOnList',
  'offlineNoList',
  'cameraOff',
] as const;

export type ScanState = (typeof SCAN_STATES)[number];

export const scanStateOf = (value: string | undefined): ScanState | null =>
  SCAN_STATES.find((state) => state === value) ?? null;

/** The offline strip's count of arrivals kept on this device: the boards draw 12, 1 and 0. */
export const WAITING = [12, 1, 0] as const;

export function waitingOf(value: string | undefined): number {
  const asked = Number(value);
  return (WAITING as readonly number[]).includes(asked) ? asked : WAITING[0];
}

export const NOW_AT = '18:41';
export const OFFLINE_SINCE = '18:31';

export interface Scanned {
  key: string;
  name: string;
  kind: ReplyKind;
  /** The day of the reply, for its line; none for a companion. */
  when: string | null;
  companion: boolean;
  arrivedAt: string | null;
  by: string | null;
}

export type ScanResult =
  | { kind: 'guest'; people: Scanned[]; twice: boolean }
  | { kind: 'notOnList' }
  | { kind: 'noList' }
  | { kind: 'cameraOff' };

/** The codes the demo's camera reads in turn, each the guest a board draws: a code holds the guest and nothing else. */
export const READS = ['ines', 'folasade', 'musa', 'camille', null] as const;

function peopleOf(key: string): Scanned[] {
  const g = GUESTS.find((one) => one.key === key);
  if (g == null) throw new Error(`The sample has ${key}.`);
  return doorPeople()
    .filter((p) => p.key === key || p.key.startsWith(`${key}.`))
    .flatMap((p) =>
      p.kind === 'walkin'
        ? []
        : [
            {
              key: p.key,
              name: p.name,
              kind: p.kind,
              when: p.companion ? null : g.when,
              companion: p.companion,
              arrivedAt: p.arrivedAt,
              by: p.by,
            },
          ],
    );
}

/** What the code read brings up: the guest and their companions, or the one answer for any code not on the list. */
export function readOf(key: string | null): ScanResult {
  if (key == null) return { kind: 'notOnList' };
  const people = peopleOf(key);
  return { kind: 'guest', people, twice: people[0]?.arrivedAt != null };
}

export function resultOf(state: ScanState | null): ScanResult | null {
  switch (state) {
    case 'valid':
      return readOf('ines');
    case 'arrivedFromScan': {
      const read = readOf('ines');
      if (read.kind !== 'guest') return read;
      const [host, ...rest] = read.people;
      if (host == null) return read;
      return { ...read, people: [{ ...host, arrivedAt: NOW_AT, by: READER }, ...rest] };
    }
    case 'validHeld':
      return readOf('folasade');
    case 'alreadyArrived':
      return readOf('musa');
    case 'notComingNow':
      return readOf('camille');
    case 'notOnList':
    case 'offlineNotOnList':
      return { kind: 'notOnList' };
    case 'offlineNoList':
      return { kind: 'noList' };
    case 'cameraOff':
      return { kind: 'cameraOff' };
    default:
      return null;
  }
}

export function isOffline(state: ScanState | null): boolean {
  return state === 'offline' || state === 'offlineNotOnList' || state === 'offlineNoList';
}

/** The next code the demo's camera reads after this one, so Scan the next code walks every result. */
export function nextRead(last: string | null | undefined): string | null {
  const at = last === undefined ? -1 : READS.indexOf(last as (typeof READS)[number]);
  return READS[(at + 1) % READS.length] ?? null;
}

/** The count after an arrival: anyone not Coming adds one to expected as well (sc-1454, 5 Nov). */
export function countAfter(
  count: { arrived: number; expected: number },
  kind: ReplyKind,
  by: 1 | -1,
): { arrived: number; expected: number } {
  return {
    arrived: count.arrived + by,
    expected: count.expected + (kind === 'coming' ? 0 : by),
  };
}
