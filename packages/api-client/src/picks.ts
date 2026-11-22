export type PicksRowKind = 'dish' | 'variant' | 'option';

export interface PicksRow {
  id: string;
  kind: PicksRowKind;
  name: string;
  dish: string | null;
  for: 'everyone' | 'children' | null;
  allergens: string[];
  chosen: number;
  defaulted: number;
  holders: string[] | null;
}

export interface PicksCourse {
  id: string;
  name: string;
  asksNothing: boolean;
  skippable: boolean;
  closed: boolean;
  rows: PicksRow[];
  kitchen: number;
  skipped: number;
  needsHost: number;
  notChosen: number;
  room: number;
  answered: number;
}

export interface PicksPerson {
  id: string;
  name: string;
}

export interface PicksHostLine {
  person: PicksPerson | null;
  course: string;
  reason: 'nothing' | 'allergy';
  pick: string | null;
  allergens: string[];
}

export interface PicksParty {
  id: string;
  replier: string;
}

export interface PicksWaiting extends PicksParty {
  people: (PicksPerson & { courses: string[] })[];
}

export interface PicksRoomPerson extends PicksPerson {
  party: string;
  allergens: string[];
}

export interface EventPicks {
  updatedAt: string;
  room: number;
  held: number;
  answered: number;
  percent: number;
  allIn: boolean;
  courses: PicksCourse[];
  needsHost: PicksHostLine[] | null;
  waiting: PicksWaiting[] | null;
  people: PicksRoomPerson[] | null;
  parties: PicksParty[] | null;
  canChoose: boolean;
}

export interface HostPick {
  answer: 'chosen' | 'chefsChoice' | 'skipped';
  dish?: string;
  variant?: string | null;
  options?: string[];
  anyway?: boolean;
}

const record = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw != null ? (raw as Record<string, unknown>) : {};
const num = (raw: unknown): number => (typeof raw === 'number' ? raw : 0);
const str = (raw: unknown): string => (typeof raw === 'string' ? raw : '');
const strings = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : [];
const list = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : []);

function asPerson(raw: unknown): PicksPerson {
  const one = record(raw);

  return { id: str(one.id), name: str(one.name) };
}

function asRow(raw: unknown): PicksRow {
  const one = record(raw);

  return {
    id: str(one.id),
    kind: one.kind === 'variant' || one.kind === 'option' ? one.kind : 'dish',
    name: str(one.name),
    dish: typeof one.dish === 'string' ? one.dish : null,
    for: one.for === 'children' || one.for === 'everyone' ? one.for : null,
    allergens: strings(one.allergens),
    chosen: num(one.chosen),
    defaulted: num(one.defaulted),
    holders: Array.isArray(one.holders) ? strings(one.holders) : null,
  };
}

function asCourse(raw: unknown): PicksCourse {
  const one = record(raw);

  return {
    id: str(one.id),
    name: str(one.name),
    asksNothing: one.asksNothing === true,
    skippable: one.skippable === true,
    closed: one.closed === true,
    rows: list(one.rows).map(asRow),
    kitchen: num(one.kitchen),
    skipped: num(one.skipped),
    needsHost: num(one.needsHost),
    notChosen: num(one.notChosen),
    room: num(one.room),
    answered: num(one.answered),
  };
}

export function asEventPicks(raw: unknown): EventPicks | null {
  const one = record(raw);
  if (typeof one.room !== 'number' || !Array.isArray(one.courses)) return null;

  return {
    updatedAt: str(one.updatedAt),
    room: one.room,
    held: num(one.held),
    answered: num(one.answered),
    percent: num(one.percent),
    allIn: one.allIn === true,
    courses: one.courses.map(asCourse),
    needsHost: Array.isArray(one.needsHost)
      ? one.needsHost.map((line) => {
          const host = record(line);

          return {
            person: host.person == null ? null : asPerson(host.person),
            course: str(host.course),
            reason: host.reason === 'allergy' ? 'allergy' : 'nothing',
            pick: typeof host.pick === 'string' ? host.pick : null,
            allergens: strings(host.allergens),
          };
        })
      : null,
    waiting: Array.isArray(one.waiting)
      ? one.waiting.map((party) => {
          const reply = record(party);

          return {
            id: str(reply.id),
            replier: str(reply.replier),
            people: list(reply.people).map((person) => ({
              ...asPerson(person),
              courses: strings(record(person).courses),
            })),
          };
        })
      : null,
    people: Array.isArray(one.people)
      ? one.people.map((person) => ({
          ...asPerson(person),
          party: str(record(person).party),
          allergens: strings(record(person).allergens),
        }))
      : null,
    parties: Array.isArray(one.parties)
      ? one.parties.map((party) => ({
          id: str(record(party).id),
          replier: str(record(party).replier),
        }))
      : null,
    canChoose: one.canChoose === true,
  };
}
