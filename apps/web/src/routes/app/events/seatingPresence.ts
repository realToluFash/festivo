import { type ColleagueChoice, type PlanSubscriber } from '@soirely/api-client';
import { initials } from '@soirely/domain';
import { createContext, useContext } from 'react';

const TONES = 6;

/** Someone else with the plan open, in their colour by the order they arrived (sc-4719). */
export interface Colleague {
  userId: string;
  name: string;
  initials: string;
  tone: number;
  editor: boolean;
}

/** A colleague's choice as the plan draws it: on the item, and the chair when it is one of a table's. */
export interface ColleagueRing extends Colleague {
  chair: number | null;
}

export interface PresenceState {
  /** Each tab open on the plan, by the hub's subscriber. */
  tabs: Record<string, PlanSubscriber>;
  /** Everyone seen, in the order they arrived, for their colour. */
  arrived: string[];
  chosen: Record<string, ColleagueChoice['chosen']>;
  /** Lost only once a connection has failed, so a page still opening says nothing. */
  connection: 'opening' | 'open' | 'lost';
  spoken: string;
}

export const NOBODY_ELSE: PresenceState = {
  tabs: {},
  arrived: [],
  chosen: {},
  connection: 'opening',
  spoken: '',
};

function arrive(state: PresenceState, userId: string): string[] {
  return state.arrived.includes(userId) ? state.arrived : [...state.arrived, userId];
}

function hereNow(tabs: Record<string, PlanSubscriber>, userId: string): PlanSubscriber | null {
  return Object.values(tabs).find((tab) => tab.userId === userId) ?? null;
}

/** The hub's list on (re)connecting replaces what was known, without announcing anyone. */
export function listed(state: PresenceState, list: PlanSubscriber[]): PresenceState {
  const tabs = Object.fromEntries(list.map((tab) => [tab.subscriber, tab]));
  const arrived = list.reduce(
    (order, tab) => arrive({ ...state, arrived: order }, tab.userId),
    state.arrived,
  );
  const chosen = Object.fromEntries(
    Object.entries(state.chosen).filter(([userId]) => hereNow(tabs, userId) != null),
  );

  return { ...state, tabs, arrived, chosen, connection: 'open' };
}

/** One tab arriving or leaving; `say` words the arrival or departure of a person, not of their second tab. */
export function changed(
  state: PresenceState,
  tab: PlanSubscriber,
  me: string,
  say: (key: 'joinedPlan' | 'leftPlan', name: string) => string,
): PresenceState {
  const wasHere = hereNow(state.tabs, tab.userId) != null;
  const tabs = { ...state.tabs };

  if (tab.active) tabs[tab.subscriber] = tab;
  else delete tabs[tab.subscriber];

  const isHere = hereNow(tabs, tab.userId) != null;
  const chosen = { ...state.chosen };
  if (!isHere) delete chosen[tab.userId];
  const spoken =
    tab.userId === me || wasHere === isHere
      ? state.spoken
      : say(isHere ? 'joinedPlan' : 'leftPlan', tab.name);

  return { ...state, tabs, chosen, spoken, arrived: arrive(state, tab.userId) };
}

/** An editor's choice; a viewer's is never shared, and is dropped should one arrive. */
export function chose(state: PresenceState, choice: ColleagueChoice): PresenceState {
  const by = hereNow(state.tabs, choice.userId);
  if (by != null && !by.editor) return state;

  return { ...state, chosen: { ...state.chosen, [choice.userId]: choice.chosen } };
}

/** Everyone else here, each once however many tabs they have open, in the order they arrived. */
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

/** What each colleague here has chosen, by item, for the room and the side panel to draw. */
export const RingsContext = createContext<Readonly<Record<string, ColleagueRing>>>({});

export function useRing(id: string): ColleagueRing | null {
  return useContext(RingsContext)[id] ?? null;
}

/** What you have chosen, as the API tells your colleagues. */
export interface OwnChoice {
  kind: 'table' | 'row' | 'seat';
  id: string;
  chair: number | null;
}
