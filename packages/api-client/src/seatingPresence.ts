/** Someone with an event's seating plan open, as the hub lists them from their token (sc-4719): their name, never their email address. One person with two tabs open is two subscribers. */
export interface PlanSubscriber {
  subscriber: string;
  userId: string;
  name: string;
  editor: boolean;
  active: boolean;
}

/** What an editor has chosen on the plan: a table, row or seat, one of a table's chairs by its number, or nothing. */
export interface ColleagueChoice {
  userId: string;
  chosen: { kind: 'table' | 'row' | 'seat'; id: string; chair: number | null } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The hub's topic for who has `topic` open: the list of them, and each one arriving and leaving. */
export function subscribersTopic(topic: string): string {
  return `/.well-known/mercure/subscriptions/${encodeURIComponent(topic)}{/subscriber}`;
}

/** Where the hub lists everyone with `topic` open now. */
export function subscribersUrl(hub: string, topic: string): string {
  return `${hub.replace(/\/$/, '')}/subscriptions/${encodeURIComponent(topic)}`;
}

/** Null for anything but a subscription to `topic` whose token named a person, so the hub's other updates are dropped. */
export function asPlanSubscriber(raw: unknown, topic: string): PlanSubscriber | null {
  if (!isRecord(raw) || raw['type'] !== 'Subscription' || raw['topic'] !== topic) return null;
  const { subscriber, active, payload } = raw;
  if (typeof subscriber !== 'string' || typeof active !== 'boolean' || !isRecord(payload))
    return null;
  const { userId, name, editor } = payload;
  if (typeof userId !== 'string' || typeof name !== 'string' || typeof editor !== 'boolean')
    return null;

  return { subscriber, userId, name, editor, active };
}

/** Everyone the hub lists with `topic` open, from its subscriptions answer. */
export function asPlanSubscribers(raw: unknown, topic: string): PlanSubscriber[] {
  if (!isRecord(raw) || !Array.isArray(raw['subscriptions'])) return [];

  return raw['subscriptions'].flatMap((each: unknown) => {
    const read = asPlanSubscriber(each, topic);
    return read == null || !read.active ? [] : [read];
  });
}

/** Null for anything but an editor's choice as the API publishes it. */
export function asColleagueChoice(raw: unknown): ColleagueChoice | null {
  if (!isRecord(raw) || typeof raw['userId'] !== 'string' || !('chosen' in raw)) return null;
  const { userId, chosen } = raw;
  if (chosen === null) return { userId, chosen: null };
  if (!isRecord(chosen)) return null;
  const { kind, id, chair } = chosen;
  if (kind !== 'table' && kind !== 'row' && kind !== 'seat') return null;
  if (typeof id !== 'string') return null;

  return { userId, chosen: { kind, id, chair: typeof chair === 'number' ? chair : null } };
}

/** The userId of someone saying they still have the plan open, or null for anything else. */
export function asPlanBeat(raw: unknown): string | null {
  if (!isRecord(raw) || raw['here'] !== true || typeof raw['userId'] !== 'string') return null;

  return raw['userId'];
}
