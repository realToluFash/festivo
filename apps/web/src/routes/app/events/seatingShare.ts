import { type SeatingPlan } from '@soirely/api-client';

export type ShareByRefusal = 'empty' | 'afterEvent' | 'past';

/** Share by is a day from today up to the day before the event, both in the event's zone (pm, #5094, 20 Oct); the API refuses the same. */
export function shareByRefusal(
  typed: string,
  today: string,
  eventDay: string,
): ShareByRefusal | null {
  if (typed === '') return 'empty';
  if (typed >= eventDay) return 'afterEvent';
  if (typed < today) return 'past';

  return null;
}

/** {n} counts Coming guests in a chair and {u} Coming guests without one, as sc-4016 counts them. */
export function sharedCounts(plan: SeatingPlan): { seated: number; unseated: number } {
  const coming = plan.guests.filter((guest) => guest.reply === 'coming');

  return {
    seated: coming.filter((guest) => guest.seat != null).length,
    unseated: coming.filter((guest) => guest.seat == null).length,
  };
}
