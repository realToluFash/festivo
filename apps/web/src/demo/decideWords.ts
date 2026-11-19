/** What a decision costs (sc-86): the answer's words, the board's proposals for [en]. Add guest's own words are Guests A's, in `GW`. */
export const DECIDE_WORDS = {
  addCompanion: 'Add a companion',
  head: 'What adding them would cost',
  rise: (amount: string) => `+${amount} if all come`,
  upperOnly: (total: string, settled: string) =>
    `If everyone comes, it would be ${total}. Settled, it stays ${settled}, because new guests have not replied.`,
  moved: (from: string, to: string, headsFrom: number, headsTo: number) =>
    `${from} → ${to} · ${headsFrom} → ${headsTo} if all come`,
  plus: (amount: string) => `+${amount}`,
  notKnown: 'Not known',
  notKnownIfAll: 'Not known if all come',
  notPricedYet: 'Not priced yet, so its cost is not known',
  fullNotKnown: (count: number) =>
    count === 1
      ? 'Full cost not known: 1 cost it moves has no price yet.'
      : `Full cost not known: ${count} costs it moves have no price yet.`,
  noChange: 'No change',
  nothingPerGuest: 'Nothing in this budget is counted per guest.',
  overCeiling: 'This would take the event over its ceiling.',
  overCategory: (category: string) => `This would take ${category} over its ceiling.`,
  ifEveryone: (total: string, ceiling: string) =>
    `If everyone comes, it would be ${total} against ${ceiling}.`,
} as const;
