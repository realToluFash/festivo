import type { Mesh } from '../mesh.ts';

/** An event as Today draws it, a sample or a real one: its name and its colour. */
export interface ShownEvent {
  id: string;
  name: string;
  mesh: Mesh;
}

export interface AgendaItem {
  time: string;
  title: string;
  event: ShownEvent;
  note: string;
}

export interface AgendaDay {
  date: string;
  day: string;
  when: string;
  today: boolean;
  items: AgendaItem[];
}

export interface StripDay {
  weekday: string;
  number: string;
  today: boolean;
  dots: ShownEvent[];
}

export interface StripBar {
  event: ShownEvent;
  start: number;
  span: number;
  label: string;
  /** Started before the week shown, so it runs in from the left edge. */
  openLeft: boolean;
  /** Its row, 0 first: bars that share a day never share a row (sc-37302). */
  lane: number;
}

/** A multi-day event's first and last day, each kept whole when the row wraps (sc-39091). */
export interface DayRange {
  first: string;
  last: string;
}

export interface EventCard {
  event: ShownEvent;
  name: string;
  dates: string | DayRange;
  count: string;
  live: boolean;
  draft: boolean;
  stage: string | null;
  ready: { words: string; percent: number } | null;
}

export interface RailStop {
  time: string;
  name: string;
  state: 'done' | 'now' | 'next' | 'later';
}

export interface Now {
  event: ShownEvent;
  name: string;
  live: string;
  happening: string;
  until: string;
  behind: string;
  next: { time: string; title: string };
  arrived: number;
  expected: number;
  rail: RailStop[];
  /** Where the moment sits along the rail, from 0 at its first stop to 1 at its last. */
  at: number;
  ends: string;
}

export interface Moment {
  kind: 'plan' | 'day' | 'quiet' | 'first';
  /** False draws only what the product can show today, from the events' own dates. */
  full: boolean;
  eyebrow: string;
  hello: string;
  lead: string | null;
  sub: string;
  days: StripDay[];
  bars: StripBar[];
  agenda: AgendaDay[];
  nothing: string;
  nextUp: { event: ShownEvent; name: string; when: string } | null;
  events: EventCard[];
  now: Now | null;
}

/** Where a click on Today goes: the demo names it in a toast, the product opens it. */
export type Opens =
  | { to: 'event'; id: string; name: string }
  | { to: 'calendar' | 'events' | 'create' | 'notifications' | 'runOfShow' };

export type Open = (opens: Opens) => void;
