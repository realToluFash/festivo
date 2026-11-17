import { type ColleagueChoice, type PlanSubscriber } from '@soirely/api-client';
import { initials, listFormat } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { createContext, useContext } from 'react';

import { currentLocale } from '../../../i18n/index.ts';

const TONES = 6;
/** A renewed connection is a new subscriber, often published after the old one leaves; a departure waits this long for it. */
export const LEAVING_HOLD_MS = 1_000;
/** How often an open page says it is still here; its own stream hears that too, so a quiet stream is a dead one. */
export const BEAT_MS = 5_000;
/** A page that has heard nothing for this long takes its own connection for dead (sc-4719, #62200). */
export const SILENT_MS = 12_000;
/** A colleague unheard for this long is let go of, so a connection that died without a word goes within 30 seconds. */
export const QUIET_MS = 15_000;

export interface Colleague {
  userId: string;
  name: string;
  initials: string;
  tone: number;
  editor: boolean;
}

export interface ColleagueRing extends Colleague {
  chair: number | null;
}

export interface PresenceState {
  tabs: Record<string, PlanSubscriber>;
  /** Everyone seen, in the order they arrived, for their colour. */
  arrived: string[];
  chosen: ColleagueChoice[];
  /** Tabs closed but still counted, until {@link departed} lets them go. */
  leaving: string[];
  /** Lost only once a connection has failed, so a page still opening says nothing. */
  connection: 'opening' | 'open' | 'lost';
  spoken: string;
  /** When each person last said they were here, or arrived. */
  heard: Record<string, number>;
  /** People the hub still lists but who have not been heard for {@link QUIET_MS}. */
  quiet: string[];
}

export const NOBODY_ELSE: PresenceState = {
  tabs: {},
  arrived: [],
  chosen: [],
  leaving: [],
  connection: 'opening',
  spoken: '',
  heard: {},
  quiet: [],
};

function arrive(state: PresenceState, userId: string): string[] {
  return state.arrived.includes(userId) ? state.arrived : [...state.arrived, userId];
}

function hereNow(tabs: Record<string, PlanSubscriber>, userId: string): PlanSubscriber | null {
  return Object.values(tabs).find((tab) => tab.userId === userId) ?? null;
}

function present(tabs: Record<string, PlanSubscriber>, quiet: string[], userId: string): boolean {
  return hereNow(tabs, userId) != null && !quiet.includes(userId);
}

/** Everyone the hub lists, each given {@link QUIET_MS} to be heard from again unless they had already gone quiet. */
export function listed(state: PresenceState, list: PlanSubscriber[], now: number): PresenceState {
  const tabs = Object.fromEntries(list.map((tab) => [tab.subscriber, tab]));
  const arrived = list.reduce(
    (order, tab) => arrive({ ...state, arrived: order }, tab.userId),
    state.arrived,
  );
  const chosen = state.chosen.filter((choice) => hereNow(tabs, choice.userId) != null);
  const quiet = state.quiet.filter((userId) => hereNow(tabs, userId) != null);
  const heard = { ...state.heard };
  for (const tab of list) if (!quiet.includes(tab.userId)) heard[tab.userId] = now;

  return { ...state, tabs, arrived, chosen, quiet, heard, leaving: [], connection: 'open' };
}

/** One tab arriving or leaving; `say` words the arrival or departure of a person, not of their second tab, nor of a tab they renewed. */
export function changed(
  state: PresenceState,
  tab: PlanSubscriber,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
  now: number,
): PresenceState {
  if (!tab.active && state.leaving.includes(tab.subscriber)) return state;
  if (!tab.active && tab.userId !== me && state.tabs[tab.subscriber] != null) {
    const others = Object.values(state.tabs).filter(
      (one) =>
        one.userId === tab.userId &&
        one.subscriber !== tab.subscriber &&
        !state.leaving.includes(one.subscriber),
    );
    if (others.length === 0) return { ...state, leaving: [...state.leaving, tab.subscriber] };
  }

  const tabs = { ...state.tabs };
  let { leaving, quiet, heard } = state;
  if (tab.active) {
    for (const held of leaving) if (tabs[held]?.userId === tab.userId) delete tabs[held];
    leaving = leaving.filter((held) => tabs[held] != null);
    quiet = quiet.filter((userId) => userId !== tab.userId);
    heard = { ...heard, [tab.userId]: now };
  }

  return without({ ...state, tabs, leaving, quiet, heard }, tab, me, say, state);
}

/** Someone saying they still have the plan open: one who had gone quiet is back. */
export function beat(
  state: PresenceState,
  userId: string,
  now: number,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
): PresenceState {
  const heard = { ...state.heard, [userId]: now };
  const tab = hereNow(state.tabs, userId);
  if (tab == null || !state.quiet.includes(userId)) return { ...state, heard };

  return {
    ...state,
    heard,
    quiet: state.quiet.filter((one) => one !== userId),
    spoken: say('joinedPlan', tab.name),
  };
}

/** Lets go of everyone unheard for {@link QUIET_MS}, whose connection died without a word, saying each by name; nobody while your own is not open, since then you cannot hear them. */
export function quieted(
  state: PresenceState,
  now: number,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
): PresenceState {
  if (state.connection !== 'open') return state;
  const gone = [...new Set(Object.values(state.tabs).map((tab) => tab.userId))].filter(
    (userId) =>
      userId !== me &&
      !state.quiet.includes(userId) &&
      (state.heard[userId] ?? now) < now - QUIET_MS,
  );
  if (gone.length === 0) return state;
  const spoken = gone.map((userId) => say('leftPlan', hereNow(state.tabs, userId)!.name)).join(' ');

  return { ...state, quiet: [...state.quiet, ...gone], spoken };
}

/** A page held back past a beat, by sleep or a hidden tab, heard nobody while it was held: everyone not already quiet is given {@link QUIET_MS} afresh, as on a listing. */
export function woke(state: PresenceState, now: number): PresenceState {
  const heard = { ...state.heard };
  for (const tab of Object.values(state.tabs))
    if (!state.quiet.includes(tab.userId)) heard[tab.userId] = now;

  return { ...state, heard };
}

/** A closed tab nobody renewed in time: its person leaves, unless another of their tabs is still here. */
export function departed(
  state: PresenceState,
  subscriber: string,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
): PresenceState {
  const tab = state.tabs[subscriber];
  if (tab == null || !state.leaving.includes(subscriber)) return state;
  const leaving = state.leaving.filter((held) => held !== subscriber);

  return without({ ...state, leaving }, { ...tab, active: false }, me, say, state);
}

function without(
  next: PresenceState,
  tab: PlanSubscriber,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
  was: PresenceState,
): PresenceState {
  const wasHere = present(was.tabs, was.quiet, tab.userId);
  const tabs = { ...next.tabs };

  if (tab.active) tabs[tab.subscriber] = tab;
  else delete tabs[tab.subscriber];

  const listedStill = hereNow(tabs, tab.userId) != null;
  const quiet = listedStill ? next.quiet : next.quiet.filter((one) => one !== tab.userId);
  const isHere = present(tabs, quiet, tab.userId);
  const chosen = listedStill ? next.chosen : next.chosen.filter((one) => one.userId !== tab.userId);
  const spoken =
    tab.userId === me || wasHere === isHere
      ? next.spoken
      : say(isHere ? 'joinedPlan' : 'leftPlan', tab.name);

  return { ...next, tabs, quiet, chosen, spoken, arrived: arrive(next, tab.userId) };
}

/** An editor's choice; a viewer's is never shared, and is dropped should one arrive. */
export function chose(state: PresenceState, choice: ColleagueChoice): PresenceState {
  const by = hereNow(state.tabs, choice.userId);
  if (by != null && !by.editor) return state;

  const others = state.chosen.filter((one) => one.userId !== choice.userId);

  return { ...state, chosen: [...others, choice] };
}

export function colleaguesOf(state: PresenceState, me: string): Colleague[] {
  const others = state.arrived.filter((userId) => userId !== me);

  return others.flatMap((userId) => {
    const tab = hereNow(state.tabs, userId);
    if (tab == null || state.quiet.includes(userId)) return [];

    return [
      {
        userId,
        name: tab.name,
        initials: initials(tab.name),
        tone: others.indexOf(userId) % TONES,
        editor: tab.editor,
      },
    ];
  });
}

/** None while your own connection is lost: a ring you cannot hear cleared is as stale as its chip (#62213). */
export function ringsOf(state: PresenceState, me: string): Record<string, ColleagueRing[]> {
  if (state.connection === 'lost') return {};
  const editors = new Map(
    colleaguesOf(state, me)
      .filter((colleague) => colleague.editor)
      .map((colleague) => [colleague.userId, colleague]),
  );
  const rings: Record<string, ColleagueRing[]> = {};

  for (const { userId, chosen } of state.chosen) {
    const colleague = editors.get(userId);
    if (colleague == null || chosen == null) continue;
    (rings[chosen.id] ??= []).push({ ...colleague, chair: chosen.chair });
  }

  return rings;
}

const NO_RINGS: readonly ColleagueRing[] = [];

export const RingsContext = createContext<Readonly<Record<string, readonly ColleagueRing[]>>>({});

export function useRings(id: string): readonly ColleagueRing[] {
  return useContext(RingsContext)[id] ?? NO_RINGS;
}

/** An item's name, then who chose it whole and who chose each of its seats, in the order they chose. */
export function chosenBy(t: TFunction, name: string, rings: readonly ColleagueRing[]): string {
  const names = (some: readonly ColleagueRing[]) =>
    listFormat(currentLocale(), { type: 'conjunction' }).format(some.map((one) => one.name));
  const whole = rings.filter((one) => one.chair == null);
  const seats = [...new Set(rings.flatMap((one) => (one.chair == null ? [] : [one.chair])))];

  return seats.reduce(
    (said, seat) =>
      t('seating.seatChosenBy', {
        name: said,
        seat,
        by: names(rings.filter((one) => one.chair === seat)),
      }),
    whole.length === 0 ? name : t('seating.chosenBy', { name, by: names(whole) }),
  );
}

export interface OwnChoice {
  kind: 'table' | 'row' | 'seat';
  id: string;
  chair: number | null;
}
