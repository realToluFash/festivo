import { demoWords } from './demoWords.ts';
import {
  type Item,
  type Party,
  type Plan,
  GROUP_ORDER,
  TIME_ZONE,
  isTable,
  membersOf,
  peopleIn,
  readingOrder,
  sideBySide,
} from './seating.ts';

/** sc-4019's English, from its AC, its Decided sections and the 19 Oct boards (`AutoSeat.dc.html`); [en] owns every word. */
export const AUTO_WORDS = {
  title: 'Auto-seat by group',
  askLine_one: 'Seat 1 guest who is coming without a seat. Nobody already seated moves.',
  askLine_other:
    'Seat {{count}} guests who are coming without a seat. Nobody already seated moves.',
  askFirst: 'You will see the proposal first. Nothing is seated until you accept it.',
  replaces: 'This replaces the proposal by {{name}} · {{time}}.',
  propose: 'Propose',
  cancel: 'Cancel',
  proposedBy: 'Proposed by {{name}} · {{time}}.',
  acceptAll_one: 'Accept all (1 guest)',
  acceptAll_other: 'Accept all ({{count}} guests)',
  discardAll: 'Discard all',
  accept: 'Accept',
  discard: 'Discard',
  acceptAt: 'Accept {{table}}',
  discardAt: 'Discard {{table}}',
  proposed: 'Proposed',
  proposedCount: 'Proposed · {{n}}',
  leftOver: 'Left over · {{n}}',
  notPlaced: 'Not placed:',
  together: 'No table has {{n}} seats together for {{name}}’s party',
  apart: 'Every table with room has someone from their Apart note',
  exit: 'Needs a seat near an exit, and none is free',
  changed: '{{tables}} has changed since this was proposed. Run Auto-seat again.',
  changedMany: '{{tables}} have changed since this was proposed. Run Auto-seat again.',
  runAgain: 'Run Auto-seat again',
  chairProposed: 'Proposed: {{name}}',
  guests_one: '1 guest',
  guests_other: '{{count}} guests',
  atTables_one: 'at 1 table',
  atTables_other: 'at {{count}} tables',
  ready: 'Proposal ready: {{guests}} {{tables}}.',
  readyLeft_one: '1 guest is left over.',
  readyLeft_other: '{{count}} guests are left over.',
  seatedAt: '{{guests}} seated {{tables}}.',
  discarded: 'Proposal for {{table}} discarded.',
  discardedAll: 'Proposal discarded.',
} as const;

const AW = AUTO_WORDS;

/** The tray's own line when nobody is left to seat; the disabled Auto-seat button is described by it (AC: "Everyone who is coming has a seat."). */
export const TRAY_SAID = 'st-tray-said';
const { filled: say, many, listed } = demoWords(AW);

export { AW, listed, many, say };

export type Reason = 'together' | 'apart' | 'exit';

export interface LeftOver {
  party: string;
  reason: Reason;
}

/** One proposal per event (Decided, 19 Oct): who ran it, when, each table as it stood, and who could not be placed. The proposed chairs themselves are marked on the plan. */
export interface AutoSeat {
  asking: boolean;
  by: string | null;
  at: string | null;
  stamps: Readonly<Record<string, string>>;
  left: readonly LeftOver[];
}

export const NO_PROPOSAL: AutoSeat = { asking: false, by: null, at: null, stamps: {}, left: [] };

export interface Notes {
  apart: Readonly<Record<string, readonly string[]>>;
  together: Readonly<Record<string, readonly string[]>>;
  exit: readonly string[];
  nearExit: readonly string[];
}

export const NO_NOTES: Notes = { apart: {}, together: {}, exit: [], nearExit: [] };

/** The wedding's notes: Kwame apart from Amaka, Lucía and Tomás together, Marta needs a seat near an exit, and only Tables 1 and 5 are by one. */
export const SAMPLE_NOTES: Notes = {
  apart: { kwame: ['Amaka Eze'] },
  together: { lucia: ['Tomás Ferreira'], tomas: ['Lucía Ortega'] },
  exit: ['marta'],
  nearExit: ['t1', 't5'],
};

export function isProposed(plan: Plan): boolean {
  return plan.items.some((item) => item.chairs.some((chair) => chair.proposed != null));
}

/** What a table is, without the proposal on it: a change here after Propose refuses its Accept. */
export function stampOf(item: Item): string {
  return item.chairs.map((chair) => `${chair.state}:${chair.who ?? ''}`).join('|');
}

export function comingWithout(tray: readonly Party[]): number {
  return tray
    .filter((party) => party.reply === 'coming')
    .reduce((sum, party) => sum + peopleIn(party), 0);
}

function sortedParties(tray: readonly Party[]): Party[][] {
  const coming = tray.filter((party) => party.reply === 'coming' && peopleIn(party) > 0);
  const named = [...new Set(coming.flatMap((party) => (party.group == null ? [] : [party.group])))];
  const order = [
    ...GROUP_ORDER.filter((group) => named.includes(group)),
    ...named
      .filter((group) => !GROUP_ORDER.includes(group))
      .sort((a, b) => a.localeCompare(b, 'en')),
    null,
  ];

  return order.map((group) =>
    coming
      .filter((party) => (party.group ?? null) === group)
      .sort((a, b) => peopleIn(b) - peopleIn(a) || a.name.localeCompare(b.name, 'en')),
  );
}

function namesAt(item: Item): string[] {
  return item.chairs.flatMap((chair) =>
    chair.state === 'taken' && chair.who != null
      ? [chair.who]
      : chair.proposed != null
        ? [chair.proposed]
        : [],
  );
}

function freeRun(item: Item, n: number): number[] | null {
  if (n > item.chairs.length) return null;
  return sideBySide(
    {
      ...item,
      chairs: item.chairs.map((chair) =>
        chair.proposed != null ? { state: 'taken' as const } : chair,
      ),
    },
    n,
  );
}

function roomLeft(item: Item): number {
  return item.chairs.filter((chair) => chair.state === 'empty' && chair.proposed == null).length;
}

function marked(item: Item, party: Party, chairs: readonly number[]): Item {
  const who = membersOf(party);

  return {
    ...item,
    chairs: item.chairs.map((chair, index) => {
      const k = chairs.indexOf(index);

      return k < 0 || who[k] == null
        ? chair
        : { ...chair, proposed: who[k], proposedParty: party.id };
    }),
  };
}

/** The rules in Decided, 19 Oct's order, and deterministic: only empty chairs, no party split, notes kept, a group at the fewest tables, reading order. */
export function propose(
  plan: Plan,
  tray: readonly Party[],
  notes: Notes = NO_NOTES,
): { plan: Plan; left: LeftOver[] } {
  const clear = withoutProposal(plan);
  const order = readingOrder(clear.items.filter(isTable)).map((item) => item.id);
  let items = new Map(clear.items.map((item) => [item.id, item]));
  const left: LeftOver[] = [];

  for (const group of sortedParties(tray)) {
    const used: string[] = [];

    for (const party of group) {
      const n = peopleIn(party);
      const apart = notes.apart[party.id] ?? [];
      const together = notes.together[party.id] ?? [];
      const exit = notes.exit.includes(party.id);
      const fits = order.filter((id) => freeRun(items.get(id)!, n) != null);
      const kept = fits.filter((id) => !namesAt(items.get(id)!).some((one) => apart.includes(one)));
      const open = kept.filter((id) => !exit || notes.nearExit.includes(id));

      if (open.length === 0) {
        left.push({
          party: party.id,
          reason: fits.length === 0 ? 'together' : kept.length === 0 ? 'apart' : 'exit',
        });
        continue;
      }
      const rest = group.slice(group.indexOf(party)).reduce((sum, one) => sum + peopleIn(one), 0);
      const pick =
        open.find((id) => used.includes(id)) ??
        open.find((id) => namesAt(items.get(id)!).some((one) => together.includes(one))) ??
        open.find((id) => roomLeft(items.get(id)!) >= rest) ??
        open[0]!;
      const item = items.get(pick)!;

      items = new Map(items).set(pick, marked(item, party, freeRun(item, n)!));
      if (!used.includes(pick)) used.push(pick);
    }
  }

  return { plan: { ...clear, items: clear.items.map((item) => items.get(item.id) ?? item) }, left };
}

function unmark(item: Item): Item {
  if (!item.chairs.some((chair) => chair.proposed != null)) return item;
  return {
    ...item,
    chairs: item.chairs.map((chair) => {
      if (chair.proposed == null) return chair;
      const { proposed: _who, proposedParty: _party, ...rest } = chair;

      return rest;
    }),
  };
}

export function withoutProposal(plan: Plan, only?: string): Plan {
  return {
    ...plan,
    items: plan.items.map((item) => (only == null || item.id === only ? unmark(item) : item)),
  };
}

export function proposedTables(plan: Plan): Item[] {
  return readingOrder(
    plan.items.filter((item) => item.chairs.some((chair) => chair.proposed != null)),
  );
}

export function proposedParties(item: Item): string[] {
  return [
    ...new Set(
      item.chairs.flatMap((chair) => (chair.proposedParty == null ? [] : [chair.proposedParty])),
    ),
  ];
}

export function proposedGuests(plan: Plan, only?: readonly string[]): number {
  return plan.items
    .filter((item) => only == null || only.includes(item.id))
    .reduce((sum, item) => sum + item.chairs.filter((chair) => chair.proposed != null).length, 0);
}

export function isChanged(item: Item, auto: AutoSeat): boolean {
  const stamp = auto.stamps[item.id];

  return stamp != null && stamp !== stampOf(item);
}

export function changedTables(plan: Plan, auto: AutoSeat): Item[] {
  return proposedTables(plan).filter((item) => isChanged(item, auto));
}

export function accepted(
  plan: Plan,
  tray: readonly Party[],
  ids: readonly string[],
): { plan: Plan; tray: Party[]; guests: number } {
  const parties = new Map(tray.map((party) => [party.id, party]));
  const gone = new Set<string>();
  let guests = 0;
  const items = plan.items.map((item) => {
    if (!ids.includes(item.id)) return item;
    return {
      ...item,
      chairs: item.chairs.map((chair) => {
        if (chair.proposed == null || chair.state !== 'empty') return chair;
        const party = chair.proposedParty == null ? undefined : parties.get(chair.proposedParty);

        if (chair.proposedParty != null) gone.add(chair.proposedParty);
        guests += 1;
        return {
          state: 'taken' as const,
          who: chair.proposed,
          party: party?.id,
          reply: party?.reply,
        };
      }),
    };
  });

  return { plan: { ...plan, items }, tray: tray.filter((party) => !gone.has(party.id)), guests };
}

/** Keeps the proposal true to the plan: a guest seated by hand, or a table deleted, drops out of it; with nothing left it is gone. */
export function tidied(
  plan: Plan,
  tray: readonly Party[],
  auto: AutoSeat,
): { plan: Plan; auto: AutoSeat } {
  if (auto.by == null && !isProposed(plan)) return { plan, auto };
  const waiting = new Set(tray.map((party) => party.id));
  let touched = false;
  const items = plan.items.map((item) => {
    const keep = auto.stamps[item.id] != null;

    if (
      !item.chairs.some(
        (chair) =>
          chair.proposed != null &&
          (!keep || !waiting.has(chair.proposedParty ?? '') || chair.state !== 'empty'),
      )
    )
      return item;
    touched = true;
    return {
      ...item,
      chairs: item.chairs.map((chair) => {
        if (chair.proposed == null) return chair;
        if (keep && waiting.has(chair.proposedParty ?? '') && chair.state === 'empty') return chair;
        const { proposed: _who, proposedParty: _party, ...rest } = chair;

        return rest;
      }),
    };
  });
  const next = touched ? { ...plan, items } : plan;
  const left = auto.left.filter((one) => waiting.has(one.party));
  const live = isProposed(next) || left.length > 0;

  if (!live && auto.by != null)
    return { plan: next, auto: { ...NO_PROPOSAL, asking: auto.asking } };
  if (left.length !== auto.left.length) return { plan: next, auto: { ...auto, left } };
  return { plan: next, auto };
}

export function timeOf(iso: string, locale = 'en-GB', timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

export function reasonWords(reason: Reason, party: Party): string {
  if (reason === 'together') return say(AW.together, { n: peopleIn(party), name: party.name });
  return reason === 'apart' ? AW.apart : AW.exit;
}

export function changedWords(items: readonly Item[]): string {
  return say(items.length === 1 ? AW.changed : AW.changedMany, {
    tables: listed(items.map((item) => item.name)),
  });
}

export function readyWords(guests: number, tables: number, left: number): string {
  const ready = say(AW.ready, { guests: many('guests', guests), tables: many('atTables', tables) });

  return left === 0 ? ready : `${ready} ${many('readyLeft', left)}`;
}

export function seatedWords(guests: number, tables: number): string {
  return say(AW.seatedAt, { guests: many('guests', guests), tables: many('atTables', tables) });
}

export const PROPOSED_AT = '2026-11-03T20:14:00Z';
export const EARLIER_AT = '2026-11-03T19:52:00Z';

export const AUTO_KEYS = [
  'autoBefore',
  'autoAsk',
  'autoNobody',
  'autoProposed',
  'autoLeftOver',
  'autoAccepted',
  'autoChanged',
  'autoAllChanged',
  'autoReplace',
  'autoTables',
  'autoList',
  'autoReadOnly',
] as const;

export type AutoState = (typeof AUTO_KEYS)[number];

export function isAutoState(value: string | null): value is AutoState {
  return AUTO_KEYS.some((key) => key === value);
}
