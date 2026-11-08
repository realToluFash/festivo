/** What a decision costs (sc-86) in Guests' Add guest: the board's proposals for [en], with Guests A's own words. */
export const DECIDE_WORDS = {
  guests: 'Guests',
  addGuest: 'Add guest',
  name: 'Name',
  companions: 'Companions',
  noReply: 'No reply',
  remove: 'Remove',
  addCompanion: 'Add a companion',
  companionName: (nth: number, count: number) => `Companion’s full name, ${nth} of ${count}`,
  head: 'What adding them would cost',
  rise: (amount: string) => `+${amount} if all come`,
  upperOnly: (total: string, settled: string) =>
    `On the upper figure only, now ${total}. New guests have not replied, so the settled ${settled} stays.`,
  moved: (from: string, to: string, headsFrom: number, headsTo: number) =>
    `${from} → ${to} · ${headsFrom} → ${headsTo} if all come`,
  plus: (amount: string) => `+${amount}`,
  notKnown: 'Not known',
  notPricedYet: 'Not priced yet, so its cost is not known',
  fullNotKnown: (count: number) =>
    count === 1
      ? 'Full cost not known: 1 cost it moves has no price yet.'
      : `Full cost not known: ${count} costs it moves have no price yet.`,
  noChange: 'No change',
  nothingPerGuest: 'Nothing in this budget is counted per guest.',
  overCeiling: 'This would take the event over its ceiling.',
  ifEveryone: (total: string, ceiling: string) =>
    `If everyone comes, it would be ${total} against ${ceiling}.`,
} as const;
