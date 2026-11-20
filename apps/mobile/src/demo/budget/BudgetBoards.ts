import { BUDGET_DEMO_STATES, type BudgetState } from './BudgetModel.ts';
import { WEDDING } from './BudgetSample.ts';

/** The demo home's Budget group: each app ?state= of budget-a-spec.md §9, deep-linked into the wedding. */
const BOARDS: Record<BudgetState, readonly [string, string]> = {
  populated: ['in use', 'Mark paid on the card, and on each Due next row'],
  early_on: ['early on', 'Nothing scheduled: the card says 2 costs not priced yet'],
  scrolled: ['scrolled', 'The ceiling, Against plan, Who is paying, the costs'],
  loading: ['loading', 'The card’s place and the rows as shapes'],
  live_update: ['live', 'Dinner goes to £70.00 a head; what it moved washes'],
  not_live: ['not live', 'Figures as of 09:32; Mark paid needs a connection'],
  reconnecting: ['reconnecting', 'Getting the latest figures…'],
  never_loaded: ['never loaded', 'No figures and no zeros'],
  no_lines: ['no costs yet', 'Costs are added on a computer; Who is paying opens'],
  nothing_due: ['nothing due, near the end', 'The card says the ceiling, no step; Nothing is due.'],
  mark_paid_open: ['Mark paid', 'sc-88’s form, £840.00 filled in'],
  mark_paid_earlier: ['Mark paid, an earlier date', 'Date paid Mon, Nov 2, from the calendar'],
  marked_paid: ['marked paid', 'The row stays with Undo; the card moves on'],
  refused_paid: ['refused, already paid', 'Julien Moreau has already marked this paid'],
  refused_cancelled: ['refused, cancelled', 'This payment has been cancelled'],
  read_only: ['read only', 'After losing vendors: no Mark paid, See plans'],
  no_budget: ['no budget (as kemi)', 'Can edit: More has no Budget'],
  refused_currency: ['refused, another currency', 'Enter the amount in British Pound'],
  refused_plan: ['refused, the plan', 'Payments cannot be marked paid on this plan'],
  ceiling_categories_only: [
    'categories only',
    'No whole-event ceiling; Catering and Flowers keep theirs',
  ],
  ceiling_live_set: [
    'a ceiling set on the web',
    'Julien Moreau sets £22,000; the tag and rows wash',
  ],
  ceiling_live_changed: ['a ceiling changed on the web', 'Now £24,000, so it is now Close'],
  ceiling_live_cleared: [
    'the ceilings cleared on the web',
    'No tag, no Ceiling row, no category states',
  ],
  reminder_overdue: ['the reminder, overdue', 'Overdue · last reminder; it opens Due now'],
  reminder_mixed: ['the reminder, mixed', '1 overdue, 2 due in the next 3 days'],
  payers: ['Who is paying', 'A row per payer with its link’s state'],
  payer_never_sent: ['a payer, never sent', 'Send to Adaeze and Tunde'],
  payer_opened: ['a payer, opened', 'Opened 3 times, Send again'],
  no_payers: ['no payers', 'Payers are added on a computer'],
  no_costs: ['payers, no costs', 'Each payer’s name and note, no zeros'],
  payer_removed: ['a payer removed', 'Removed on the web while the list was open'],
  offline: ['a payer, offline', 'Sending a link needs a connection'],
  send_failed: ['the link not created', 'Nothing has been sent, Try again'],
  long_name: ['a long name (pt)', 'The 100-character name wraps in the action'],
  payers_loading: ['payers, loading', 'The card’s place and the rows as shapes'],
  payers_live: ['payers, live', 'Room hire shared on the web; the moved shares wash'],
  payers_reconnecting: ['payers, reconnecting', 'Getting the latest figures…, then Live'],
  payers_never_loaded: ['payers, never loaded', 'No figures and no zeros'],
  payers_neither: ['no payers, no costs', 'Both lines, the costs’ line first'],
  payer_renamed: ['a payer renamed', 'Mr and Mrs Obi is now Chidi and Ngozi Obi'],
  payer_needs_amounts: ['a split that needs new amounts', 'Cars · Needs new amounts, read only'],
  payer_not_priced: ['a share not complete', '1 cost not priced yet on the share'],
  payer_paid_past: ['paid past the share', 'Nothing still to come, never below 0'],
  payer_passphrase: ['a link with a passphrase', 'Asks for a passphrase.; Send again'],
  payer_all_revoked: ['every link revoked', 'Send to Mr and Mrs Bakare, no state line'],
  due_now: ['Due now', 'From the reminder: Paid, or Paid a different amount'],
  due_marked: ['Due now, marked', 'Marked paid · £840.00, Undo'],
  due_changed: ['Due now, changed since', 'Nothing left to pay, and why: paid, cancelled'],
  due_refused: ['Due now, refused', 'This payment has been cancelled'],
  due_done: ['Due now, done', 'Nothing left to pay, the paid rows under it'],
  due_read_only: ['Due now, read only', 'No Paid, no Undo'],
};

/** The spec's viewer and language for the two states that name one; the state alone opens it. */
const VIEWER: Partial<Record<BudgetState, string>> = {
  no_budget: '&as=kemi',
  long_name: '&lang=pt',
};

export const BUDGET_BOARDS = BUDGET_DEMO_STATES.map((state) => ({
  state,
  title: `Budget · ${BOARDS[state][0]}`,
  what: BOARDS[state][1],
  href: `/demo/events/${WEDDING}?area=budget&state=${state}${VIEWER[state] ?? ''}`,
}));
