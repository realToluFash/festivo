import type { EventCover } from '@soirely/api-client';
import type { EventType } from '@soirely/domain';
/** An event's colour on Today until it has a photo. */
export type MeshKey = 'rose' | 'teal' | 'accent' | 'amber';
export type MomentName = 'plan' | 'planNow' | 'day' | 'dayNow' | 'quiet' | 'first';

/** An event as Today draws it, a sample or a real one: its name, its colour, and its photo once it has one. */
export interface ShownEvent {
  id: string;
  name: string;
  mesh: MeshKey;
  photo: { cover: EventCover; type: EventType } | null;
}

const MESHES: readonly MeshKey[] = ['rose', 'teal', 'accent', 'amber'];

/** A real event's colour until it has a photo, the same one every time it is drawn. */
export function meshFor(id: string): MeshKey {
  const sum = [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

  return MESHES[sum % MESHES.length] ?? 'accent';
}

export function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface Need {
  event: ShownEvent;
  title: string;
  due: string;
  late: boolean;
  action: string;
}

export interface AgendaItem {
  time: string;
  allDay: boolean;
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
}

export interface EventCard {
  event: ShownEvent;
  name: string;
  dates: string;
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
  name: MomentName;
  kind: 'plan' | 'day' | 'quiet' | 'first';
  /** False draws only what the product can show today, from the events' own dates. */
  full: boolean;
  time: string;
  eyebrow: string;
  hello: string;
  lead: string | null;
  sub: string;
  /** Null when the product has nothing to say yet; empty when nothing needs you. */
  needs: Need[] | null;
  days: StripDay[];
  bars: StripBar[];
  agenda: AgendaDay[];
  nothing: string;
  nextUp: { event: ShownEvent; name: string; when: string } | null;
  events: EventCard[];
  now: Now | null;
}
