/** Templates and Calibration's English (sc-96, Budget-A-Templates): sc-30710's settled words and the board's proposals. */
export const TEMPLATES_WORDS = {
  startTitle: 'Start from an earlier budget',
  startLine: 'Its costs come across with their rate. Quantities come from this event.',
  weddings: 'Weddings',
  otherEvents: 'Other events',
  startEmpty: 'Start empty',
  startFromThis: 'Start from this budget',
  aTemplate: 'A template',
  costs: (count: number) => (count === 1 ? '1 cost' : `${count} costs`),
  inPounds: 'in pounds',
  inEuros: 'in euros',
  otherCurrency: (currency: string, source: string, own: string) =>
    `Priced in ${currency} on ${source}. Enter a price in ${own}.`,
  inEurosLine: (count: number) => `${count} costs, priced in euros. Nothing is converted.`,
  templateLine: (count: number) => `A template · ${count} costs and their rates, in pounds.`,
  overLine:
    'Over, so a cost comes across at what it came to, where one paid quote covers it alone.',
  notOverLine: 'Not over yet, so every cost comes at its planned rate.',
  cameTo: (source: string, actual: string, planned: string) =>
    `From ${source}, where this came to ${actual} against ${planned} planned.`,
  severalCosts: 'At its planned rate: its quote covered several costs.',
  nothingPaid: 'At its planned rate: nothing was paid against it.',
  noQuote: 'At its planned rate: it had no quote.',
  notOverYet: 'At its planned rate: the event is not over yet.',
  basis: {
    perHead: 'Per head',
    perTable: 'Per table',
    perStaffHour: 'Per staff hour',
    perDay: 'Per day',
    fixed: 'A fixed amount',
  },
  calibrationTitle: 'Calibration',
  inPoundsHead: 'In pounds',
  inEurosHead: 'In euros',
  byCategory: 'By category',
  byVendor: 'By vendor',
  paidAcross: 'Paid across concluded events',
  fromEvents: (count: number) =>
    count === 1
      ? 'From 1 event, so not a pattern yet.'
      : count === 2
        ? 'From 2 events, so not a pattern yet.'
        : `From ${count} events.`,
  plannedPaid: (planned: string, paid: string, from: string) =>
    `Planned ${planned} · paid ${paid} · ${from}`,
  over: (amount: string, share: string) => `${amount} over, ${share}`,
  under: (amount: string, share: string) => `${amount} under, ${share}`,
  matches: 'Matches',
  and: (one: string, other: string) => `${one} and ${other}`,
  nothingToLearn:
    'Nothing to learn from yet. Calibration starts once an event is over and one of its paid quotes covers a single cost.',
  saveTitle: 'Save as template',
  name: 'Name',
  saveLine: (count: number) =>
    `It keeps the ${count} costs and their rates, in pounds, never a count. Editing it later changes no event made from it.`,
  blank: 'Enter a name for the template.',
  long: 'Shorten the name to 80 characters or fewer.',
  taken: 'A template with that name already exists. Choose another name.',
} as const;
