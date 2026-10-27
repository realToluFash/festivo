import { eventTransition, type EventState } from './eventStates.ts';

/** The API's limits on an event's hosts (sc-6713): a name in code points after trimming, and how many. */
export const HOST_NAME_MAXIMUM = 60;
export const HOSTS_MAXIMUM = 6;

export type HostProblem =
  | { problem: 'hostBlank' }
  | { problem: 'hostTooLong'; length: number }
  | { problem: 'hostDuplicate'; name: string };

/** As the API's EventRules::hostName saves it: each run of line breaks one space, then trimmed. */
export function hostNameOf(typed: string): string {
  return typed.replace(/[\r\n]+/g, ' ').trim();
}

export function hostNameLength(typed: string): number {
  return Array.from(hostNameOf(typed)).length;
}

/** One entry per row, null where the name is fine; a repeat is refused on the later row, naming the earlier as typed. */
export function hostProblems(typed: readonly string[]): (HostProblem | null)[] {
  const seen = new Map<string, string>();

  return typed.map((one) => {
    const name = hostNameOf(one);
    const length = Array.from(name).length;
    const folded = name.toLowerCase();
    const earlier = seen.get(folded);

    if (length === 0) return { problem: 'hostBlank' };
    if (length > HOST_NAME_MAXIMUM) return { problem: 'hostTooLong', length };
    if (earlier != null) return { problem: 'hostDuplicate', name: earlier };

    seen.set(folded, name);

    return null;
  });
}

export function hostsSent(typed: readonly string[]): string[] {
  return typed.map(hostNameOf);
}

export function hostsChanged(saved: readonly string[], typed: readonly string[]): boolean {
  const sent = hostsSent(typed);

  return sent.length !== saved.length || sent.some((name, index) => name !== saved[index]);
}

/** Every `{hosts}` a guest reads: the names in order, joined for the reader's language (CLDR). */
export function hostsLine(hosts: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(hosts);
}

/** Make live is refused `event_host_required` until the event names a host, as /event-states.json's `has_host` says. */
export function needsHost(event: { status: EventState; hosts: readonly string[] }): boolean {
  return (
    event.hosts.length === 0 &&
    (eventTransition(event.status, 'make_live')?.guards.includes('has_host') ?? false)
  );
}

/** A live event keeps one host: the last name cannot be removed once the event is no longer a Draft. */
export function keepsLastHost(status: EventState, typedCount: number): boolean {
  return status !== 'draft' && typedCount <= 1;
}
