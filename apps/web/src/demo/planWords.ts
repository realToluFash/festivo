/** Against plan's English (sc-89, Budget-A-Plan): the board's words, proposals for [en] unless §8 settles them. */
export const PLAN_WORDS = {
  title: 'Against plan',
  print: 'Print',
  printLine: 'For a conversation with whoever is paying',
  byCategory: 'By category · planned',
  planned: 'Planned',
  committed: 'Committed',
  paid: 'Paid',
  stillToPay: 'Still to pay',
  quoted: 'What the vendors quoted',
  payments: (count: number) => (count === 1 ? '1 payment' : `${count} payments`),
  scheduled: (count: number) =>
    count === 1 ? '1 payment scheduled' : `${count} payments scheduled`,
  plannedPerHead: 'Planned per head',
  paidPerHead: 'Paid to vendors, per head',
  paidToVendors: 'Paid to vendors',
  saidYes: (count: number) => `settled, for the ${count} who said yes`,
  came: (count: number) => `for the ${count} who came`,
  noVendorLeftOut: 'Costs with no vendor are not in it',
  unrecorded: 'Attendance was not recorded, so there is no cost per head of those who came.',
  noQuote: 'No quote',
  committedIs: (amount: string) => `committed ${amount}`,
  paidIs: (amount: string) => `paid ${amount}`,
  stillIs: (amount: string) => `still to pay ${amount}`,
  over: (amount: string, share: string | null) =>
    share == null ? `${amount} over` : `${amount} over, ${share}`,
  under: (amount: string, share: string | null) =>
    share == null ? `${amount} under` : `${amount} under, ${share}`,
  matches: 'matches',
  notKnown: 'Not known',
  sheetTitle: (event: string) => `${event} · the budget against plan`,
  printed: (day: string, time: string) => `Printed ${day} at ${time} · client figures only`,
} as const;
