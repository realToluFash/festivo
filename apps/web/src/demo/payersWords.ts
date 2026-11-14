/** Who is paying's English for the web's demo (budget-a-spec.md §8): sc-91's, sc-1300's and the Payers board's words. */
const many = (n: number, one: string, more: string): string =>
  n === 1 ? `1 ${one}` : `${n} ${more}`;

/** "A", "A and B", "A, B and C". */
export function listOf(items: readonly string[]): string {
  if (items.length < 2) return items.join('');

  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

export const PAYERS_WORDS = {
  title: 'Who is paying',
  chooseTitle: 'Choose who pays',
  budget: 'Budget',
  addAPayer: 'Add a payer',
  chooseWhoPays: 'Choose who pays',
  payers: (n: number) => many(n, 'payer', 'payers'),
  hasAPayer: 'Has a payer',
  outOf: (range: string, noPayer: string, costs: number) =>
    costs === 0
      ? `Has a payer, out of ${range}.`
      : `Has a payer, out of ${range}. ${noPayer} across ${many(costs, 'cost', 'costs')} has no payer yet.`,
  next: (cost: string) => `Next: ${cost} has no payer yet.`,
  noPayers:
    'No payers yet. Payers are who covers each cost: the couple, both sets of parents, an aunt covering the cars.',
  noCosts: 'No costs yet. Costs are added on the Budget page.',

  theirShare: 'Their share',
  fixedShare: 'Replies do not change this.',
  paid: 'Paid',
  stillToCome: 'Still to come',
  nothingStillToCome: 'Nothing still to come',
  covers: 'Covers',
  allOfIt: 'all of it',
  half: 'half',
  percentOf: (percent: string) => `${percent}%`,
  fixedPart: (amount: string) => `${amount}, a fixed amount`,
  whatIsLeft: (after: readonly string[]) => `what is left after ${listOf(after)}`,
  theirs: (name: string, amount: string) => `${name}’s ${amount}`,
  edit: 'Edit',
  remove: 'Remove',

  sendTo: (name: string) => `Send to ${name}`,
  sendAgain: 'Send again',
  sendAgainTo: (name: string) => `Send again to ${name}`,
  sending: 'Sending…',
  linkCopied: 'Link copied. Paste it into a chat.',
  theLink: 'The link',
  copyRefused: 'Could not copy here. The link is selected: press Ctrl+C or Command+C.',
  notCreated: 'The link was not created, so nothing has been sent. Try again.',

  addTitle: 'Add a payer',
  editTitle: 'Edit payer',
  add: 'Add',
  save: 'Save',
  name: 'Name',
  note: 'Note · Optional',
  noteHelp: 'For example, Covering the cars. At most 200 characters.',
  sameName: (name: string) => `Another payer on this event is already called ${name}.`,
  nameBlank: 'Enter a name.',
  nameLong: 'Use 60 characters or fewer.',
  noteLong: 'Use 200 characters or fewer.',
  percentDecimals: 'Use a number from 0 to 100, with up to two decimal places.',
  choosePayer: 'Choose a payer.',
  choosePayerOption: 'Choose a payer',
  chooseRest: 'Choose who covers what is left.',
  loading: 'Loading who is paying…',
  stale: (name: string) =>
    `${name} was removed by someone else while this was open, so nothing was saved. The costs are shown as they are now.`,
  live: 'Julien Moreau changed who pays for Room hire, so Mr and Mrs Obi’s share went down by £3,150.00.',
  notLive: 'Not live. Figures as of 09:32, 9 minutes ago.',
  asksPassphrase: 'Asks for a passphrase.',
  browserSheet: 'The browser’s share sheet',
  message: (event: string) => `Your share of ${event}, kept up to date.`,
  close: 'Close',
  percentRange: 'Use a number from 0 to 100.',
  cap: 'An event can have up to 20 payers.',
  coversCosts: (name: string, n: number) =>
    `${name} covers ${many(n, 'cost', 'costs')}. Choose who pays for them first.`,
  removed: (name: string) => `${name} removed.`,

  flagTitle: (cost: string) => `The split on ${cost} no longer adds up. Nothing was changed.`,
  flagLine: (
    cost: string,
    now: string,
    fixed: string,
    fixedBy: string,
    rest: string,
    zero: string,
  ) =>
    `${cost} now costs ${now}, less than the ${fixed} fixed for ${fixedBy}. ${fixedBy} keeps ${fixed} and ${rest} have ${zero} until the amounts change.`,
  changeTheAmounts: 'Change the amounts',

  selectNoPayer: 'Select every cost with no payer',
  noPayerYet: 'No payer yet',
  needsNewAmounts: 'Needs new amounts',
  splitAll: (name: string) => `${name}, all of it`,
  splitHalves: (names: readonly string[]) => `${listOf(names)}, half each`,
  splitPercents: (parts: readonly string[]) => listOf(parts),
  fromPayer: (amount: string, name: string) => `${amount} from ${name}`,
  splitFixed: (fixed: readonly string[], rest: string) => `${listOf(fixed)}, the rest from ${rest}`,
  costs: 'Costs',
  whoPays: 'Who pays',
  one: 'One payer covers all of it',
  percent: 'Shared by percentage',
  fixed: 'Fixed amounts, and one payer covers the rest',
  replaces: (n: number, fixedOn: readonly string[]) =>
    `${n === 1 ? '1 of these costs already has a payer. Saving replaces its split' : `${n} of these costs already have a payer. Saving replaces their split`}${
      fixedOn.length === 0 ? '' : `, including the fixed amounts on ${listOf(fixedOn)}`
    }.`,
  payer: 'Payer',
  percentLabel: (name: string) => `${name} · %`,
  amountLabel: (name: string) => `${name} · amount`,
  whoCoversTheRest: 'Who covers what is left',
  restNow: (amount: string) => `${amount} now`,
  total: (percent: string) => `Total ${percent}%`,
  notHundred: (percent: string) =>
    `The percentages come to ${percent}. Make them add up to exactly 100.`,
  amountWrong: 'Enter an amount in pounds, like 400 or 400.50.',
  tooMuch: (sum: string, least: string) =>
    `The fixed amounts come to ${sum}, more than ${least}, the least this can cost. Lower them so they fit.`,
  leave: 'Leave with no payer',
} as const;
