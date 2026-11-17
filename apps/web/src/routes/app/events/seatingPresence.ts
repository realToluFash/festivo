import { type ColleagueChoice, type PlanSubscriber } from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { createContext, useContext } from 'react';

const TONES = 6;
/** A renewed connection is a new subscriber, often published after the old one leaves; a departure waits this long for it. */
export const LEAVING_HOLD_MS = 1_000;

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
  chosen: Record<string, ColleagueChoice['chosen']>;
  /** Tabs closed but still counted, until {@link departed} lets them go. */
  leaving: string[];
  /** Lost only once a connection has failed, so a page still opening says nothing. */
  connection: 'opening' | 'open' | 'lost';
  spoken: string;
}

export const NOBODY_ELSE: PresenceState = {
  tabs: {},
  arrived: [],
  chosen: {},
  leaving: [],
  connection: 'opening',
  spoken: '',
};

function arrive(state: PresenceState, userId: string): string[] {
  return state.arrived.includes(userId) ? state.arrived : [...state.arrived, userId];
}

function hereNow(tabs: Record<string, PlanSubscriber>, userId: string): PlanSubscriber | null {
  return Object.values(tabs).find((tab) => tab.userId === userId) ?? null;
}

export function listed(state: PresenceState, list: PlanSubscriber[]): PresenceState {
  const tabs = Object.fromEntries(list.map((tab) => [tab.subscriber, tab]));
  const arrived = list.reduce(
    (order, tab) => arrive({ ...state, arrived: order }, tab.userId),
    state.arrived,
  );
  const chosen = Object.fromEntries(
    Object.entries(state.chosen).filter(([userId]) => hereNow(tabs, userId) != null),
  );

  return { ...state, tabs, arrived, chosen, leaving: [], connection: 'open' };
}

/** One tab arriving or leaving; `say` words the arrival or departure of a person, not of their second tab, nor of a tab they renewed. */
export function changed(
  state: PresenceState,
  tab: PlanSubscriber,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
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
  let leaving = state.leaving;
  if (tab.active) {
    for (const held of leaving) if (tabs[held]?.userId === tab.userId) delete tabs[held];
    leaving = leaving.filter((held) => tabs[held] != null);
  }

  return without({ ...state, tabs, leaving }, tab, me, say, state);
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
  const wasHere = hereNow(was.tabs, tab.userId) != null;
  const tabs = { ...next.tabs };

  if (tab.active) tabs[tab.subscriber] = tab;
  else delete tabs[tab.subscriber];

  const isHere = hereNow(tabs, tab.userId) != null;
  const chosen = { ...next.chosen };
  if (!isHere) delete chosen[tab.userId];
  const spoken =
    tab.userId === me || wasHere === isHere
      ? next.spoken
      : say(isHere ? 'joinedPlan' : 'leftPlan', tab.name);

  return { ...next, tabs, chosen, spoken, arrived: arrive(next, tab.userId) };
}

/** An editor's choice; a viewer's is never shared, and is dropped should one arrive. */
export function chose(state: PresenceState, choice: ColleagueChoice): PresenceState {
  const by = hereNow(state.tabs, choice.userId);
  if (by != null && !by.editor) return state;

  return { ...state, chosen: { ...state.chosen, [choice.userId]: choice.chosen } };
}

export function colleaguesOf(state: PresenceState, me: string): Colleague[] {
  const others = state.arrived.filter((userId) => userId !== me);

  return others.flatMap((userId) => {
    const tab = hereNow(state.tabs, userId);
    if (tab == null) return [];

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

/** Each item an editor here has chosen, with the first of them to have arrived. */
export function ringsOf(state: PresenceState, me: string): Record<string, ColleagueRing> {
  const rings: Record<string, ColleagueRing> = {};

  for (const colleague of colleaguesOf(state, me)) {
    const chosen = state.chosen[colleague.userId];
    if (!colleague.editor || chosen == null || rings[chosen.id] != null) continue;
    rings[chosen.id] = { ...colleague, chair: chosen.chair };
  }

  return rings;
}

export const RingsContext = createContext<Readonly<Record<string, ColleagueRing>>>({});

export function useRing(id: string): ColleagueRing | null {
  return useContext(RingsContext)[id] ?? null;
}

export interface OwnChoice {
  kind: 'table' | 'row' | 'seat';
  id: string;
  chair: number | null;
}
