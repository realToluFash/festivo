/** The guests Soirely's invitation reached in this visit, by event, so Guests reads them as Invited by Soirely's message (sc-3971). */
let sent = new Map<string, string>();

const key = (event: string, id: string) => `${event}:${id}`;

export function markSent(event: string, ids: readonly string[], on: string): void {
  sent = new Map(sent);
  for (const id of ids) sent.set(key(event, id), on);
}

export function sentOn(event: string, id: string): string | null {
  return sent.get(key(event, id)) ?? null;
}

export function resetSent(): void {
  sent = new Map();
}
