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

/** The code each state shows read (null: one not on the list); a state with none read yet is absent. The one table resultOf and the next read share. */
const READ_IN: Partial<Record<ScanState, string | null>> = {
  valid: 'ines',
  arrivedFromScan: 'ines',
  validHeld: 'folasade',
  alreadyArrived: 'musa',
  notComingNow: 'camille',
  notOnList: null,
  offlineNotOnList: null,
};

export function scannedOf(state: ScanState | null): string | null | undefined {
  return state != null && Object.hasOwn(READ_IN, state) ? READ_IN[state] : undefined;
}

export function resultOf(state: ScanState | null): ScanResult | null {
  if (state === 'offlineNoList') return { kind: 'noList' };
  if (state === 'cameraOff') return { kind: 'cameraOff' };
  const key = scannedOf(state);
  if (key === undefined) return null;
  const read = readOf(key);
  if (state !== 'arrivedFromScan' || read.kind !== 'guest') return read;
  const [host, ...rest] = read.people;
  if (host == null) return read;
  return { ...read, people: [{ ...host, arrivedAt: NOW_AT, by: READER }, ...rest] };
}

export function isOffline(state: ScanState | null): boolean {
  return state === 'offline' || state === 'offlineNotOnList' || state === 'offlineNoList';
}

/** The next code the demo's camera reads after this one, so Scan the next code walks every result. */
export function nextRead(last: string | null | undefined): string | null {
  const at = last === undefined ? -1 : READS.indexOf(last as (typeof READS)[number]);
  return READS[(at + 1) % READS.length] ?? null;
}

/** Words to read out and the tap they answer: a new tap says them again, even in the same words (useReadOut's answer). */
export interface Told {
  words: string;
  tap: number;
}

export function tell(before: Told | null, words: string): Told {
  return { words, tap: (before?.tap ?? 0) + 1 };
}

/** Search by name's way back to Check-in: each tap its own ask, so a second tap focuses the search again. */
export function searchHref(tap: number): string {
  return `/demo/guests/check-in?state=door&focus=search&tap=${tap}`;
}

export function searchAskOf(params: { focus?: string; tap?: string }): string | null {
  return params.focus === 'search' ? (params.tap ?? '0') : null;
}
