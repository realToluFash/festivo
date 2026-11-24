export const BILLING_STATES = [
  'none',
  'packs',
  'checkout_open',
  'buying',
  'buying_two',
  'buying_reload',
  'bought',
  'slow',
  'slow_one',
  'not_added',
  'confirming_plan',
  'plan_slow',
  'plan_confirmed',
  'update_open',
  'card_updated',
  'card_brandless',
  'card_wallet',
  'card_other',
  'refused',
  'offline_wait',
] as const;

export type BillingState = (typeof BILLING_STATES)[number];

export function billingStateOf(raw: string | null): BillingState {
  return BILLING_STATES.find((state) => state === raw) ?? 'none';
}

export type Currency = 'USD' | 'EUR' | 'GBP';

export function currencyOf(raw: string | null): Currency {
  return raw === 'EUR' || raw === 'GBP' ? raw : 'USD';
}

export interface Pack {
  credits: number;
  price: Readonly<Record<Currency, number>>;
}

/** sc-3928's catalogue, as sc-3932 quotes it: the EUR and GBP prices include VAT for consumers. */
export const PACKS: readonly Pack[] = [
  { credits: 1000, price: { USD: 10, EUR: 11, GBP: 9 } },
  { credits: 5000, price: { USD: 45, EUR: 50, GBP: 40 } },
  { credits: 20000, price: { USD: 160, EUR: 180, GBP: 145 } },
];

/** Enterprise in the sandbox, at the price the board draws: plan checkout is sandbox only, and the board draws it in US dollars alone. */
export const ENTERPRISE = { price: 249, currency: 'USD' as Currency, renews: '2026-12-02' };

export function money(amount: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function count(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** A wait turns into the 2-minute line 2 minutes after its payment, however often the tab was reloaded since. */
export const WAIT_MS = 120_000;

export type WaitLook = 'waiting' | 'slow';

export function waitLook(paidAt: number, now: number): WaitLook {
  return now - paidAt >= WAIT_MS ? 'slow' : 'waiting';
}

export function slowIn(paidAt: number, now: number): number {
  return Math.max(0, paidAt + WAIT_MS - now);
}

export type Method =
  | { kind: 'card'; brand: string; last4: string; month: number; year: number }
  | { kind: 'paypal' | 'apple_pay' | 'google_pay' }
  | { kind: 'other' };

const BRANDS: Readonly<Record<string, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
};

const WALLETS: Readonly<Record<'paypal' | 'apple_pay' | 'google_pay', string>> = {
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

export function expiry(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

/** What the card shows of the method: only what the provider returns, and nothing for a method it names no way to show. */
export function methodLine(method: Method): string | null {
  if (method.kind === 'other') return null;
  if (method.kind !== 'card') return WALLETS[method.kind];
  const brand = BRANDS[method.brand];

  return `${brand ?? 'Card'} ending ${method.last4} · Expires ${expiry(method.month, method.year)}`;
}

export function methodShape(method: Method): 'brand' | 'card' | 'wallet' | null {
  if (method.kind === 'other') return null;
  if (method.kind !== 'card') return 'wallet';

  return BRANDS[method.brand] == null ? 'card' : 'brand';
}

export const SAMPLE_CARD = {
  kind: 'card',
  brand: 'visa',
  last4: '4242',
  month: 8,
  year: 2028,
} as const;
export const UPDATED_CARD: Method = {
  kind: 'card',
  brand: 'visa',
  last4: '5556',
  month: 3,
  year: 2030,
};

export function methodFor(state: BillingState): Method {
  if (state === 'card_updated') return UPDATED_CARD;
  if (state === 'card_brandless') return { ...SAMPLE_CARD, brand: 'unknown' };
  if (state === 'card_wallet') return { kind: 'paypal' };
  if (state === 'card_other') return { kind: 'other' };

  return SAMPLE_CARD;
}

export interface Entry {
  id: string;
  day: string;
  words: string;
  credits: number;
}

export const SAMPLE_BALANCE = 5920;

/** sc-3934's ledger kinds on the sample billing account, newest first. A line names a channel and a count, never an event or a person. */
export const SAMPLE_LEDGER: readonly Entry[] = [
  { id: 'l1', day: '2026-11-21', words: 'SMS · 40 parts', credits: -360 },
  { id: 'l2', day: '2026-11-18', words: 'SMS · 2 parts', credits: -124 },
  { id: 'l3', day: '2026-11-01', words: 'Included credits', credits: 50 },
  { id: 'l4', day: '2026-11-01', words: 'Included credits not carried over', credits: -12 },
  { id: 'l5', day: '2026-10-28', words: 'Credits bought', credits: 5000 },
  { id: 'l6', day: '2026-10-21', words: 'SMS · 12 parts', credits: -24 },
  { id: 'l7', day: '2026-10-14', words: 'Credits returned for failed messages', credits: 18 },
  { id: 'l8', day: '2026-10-01', words: 'Included credits', credits: 50 },
  { id: 'l9', day: '2026-09-30', words: 'Included credits not carried over', credits: -50 },
  { id: 'l10', day: '2026-09-12', words: 'Credits bought', credits: 1000 },
  { id: 'l11', day: '2026-09-01', words: 'Included credits', credits: 50 },
];

export const LEDGER_SHOWN = 10;

export function withBought(ledger: readonly Entry[], entry: Entry): Entry[] {
  return [entry, ...ledger].slice(0, LEDGER_SHOWN);
}

export function signed(credits: number, locale: string): string {
  return `${credits < 0 ? '−' : '+'}${count(Math.abs(credits), locale)}`;
}

export function buyingLine(credits: number, locale: string): string {
  return `Buying ${count(credits, locale)} ${credits === 1 ? 'credit' : 'credits'}…`;
}

export function creditsWord(n: number, locale: string): string {
  return `${count(n, locale)} ${n === 1 ? 'credit' : 'credits'}`;
}

export function boughtSaid(credits: number, balance: number, locale: string): string {
  return `${W.bought} ${signed(credits, locale)}. ${creditsWord(balance, locale)}.`;
}

export function renewsLine(locale: string): string {
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${ENTERPRISE.renews}T00:00:00Z`));

  return `${money(ENTERPRISE.price, ENTERPRISE.currency, locale)} a month, renews ${date}`;
}

export function ledgerDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The board's English; the developer gives each its key in the four locales. */
export const BILLING_WORDS = {
  title: 'Plan and billing',
  refreshing: 'Refreshing…',
  yourPlan: 'Your plan',
  free: 'Free',
  enterprise: 'Enterprise',
  changePlan: 'Change plan',
  confirming: 'Confirming your payment…',
  slow: 'Your payment is being confirmed.',
  slowEmail: 'We’ll email you once it is confirmed.',
  credits: 'Credits',
  included: '50 credits included each month',
  addCredits: 'Add credits',
  packsNote:
    'Bought credits never expire. Included credits are used first and do not carry over when they renew each month. When credits run out, WhatsApp and SMS messages wait. Emails are still sent, and events keep running normally.',
  bought: 'Credits bought',
  notAdded: 'Credits not added. Nothing was charged.',
  refused: 'Nothing was changed. Your role does not include the permission this needs.',
  recent: 'Recent credit entries',
  paymentMethod: 'Payment method',
  update: 'Update',
  updateName: 'Update the payment method',
  cardNote: 'Card details go to our payment provider, never to us.',
  checkoutTitle: 'Paddle’s hosted checkout, not ours',
  pageTitle: 'Paddle’s hosted page, not ours',
  close: 'Close',
  standInLine: 'Nothing in here is designed. Soirely passes only:',
  sandbox: 'Sandbox only: at launch the checkout sells credit packs alone.',
} as const;

const W = BILLING_WORDS;

export interface DemoLink {
  to: string;
  name: string;
}

const at = (state: BillingState, name: string, more = ''): DemoLink => ({
  to: `/demo/settings/plan-and-billing?state=${state}${more}`,
  name,
});

export const BILLING_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Buying credits',
    states: [
      at('none', 'At rest: Add credits closed'),
      at('packs', 'The packs open'),
      at('packs', 'The packs in euros', '&currency=EUR'),
      at('packs', 'The packs in pounds', '&currency=GBP'),
      at('checkout_open', 'Paddle’s checkout open on 1,000 credits'),
      at('buying', 'Buying 1,000 credits…'),
      at('buying_two', 'Two purchases waiting in one tab'),
      at('buying_reload', 'Reloaded 1 minute 30 seconds after paying'),
      at('bought', 'Bought: the balance and the ledger'),
      at('slow', 'After 2 minutes: being confirmed'),
      at('slow_one', 'Two waiting, one past 2 minutes'),
      at('not_added', 'Credits not added'),
      at('offline_wait', 'Offline while buying'),
      at('refused', 'Refused: the role changed'),
      at('none', 'An Administrator: no Add credits, no Update', '&as=julien'),
    ],
  },
  {
    name: 'Changing plan (sandbox)',
    states: [
      at('confirming_plan', 'Confirming your payment…'),
      at('plan_slow', 'After 2 minutes: being confirmed'),
      at('plan_confirmed', 'Enterprise, confirmed'),
    ],
  },
  {
    name: 'Payment method',
    states: [
      at('update_open', 'Paddle’s page for a new card open'),
      at('card_updated', 'A new card saved'),
      at('card_brandless', 'A card with no brand'),
      at('card_wallet', 'PayPal'),
      at('card_other', 'A method Paddle names no way to show'),
    ],
  },
];
