import { CURRENCY, LOCALE, money, whole } from './budget.ts';
import { type DemoGroup, budgetAt } from './budgetSample.ts';
import { exampleIn, typedMinor } from './quotes.ts';
import { type Plan, type Shift, jobName, personName, samplePlan } from './shifts.ts';
import { STAFF_RATES_WORDS as W } from './staffRatesWords.ts';

export type RateKind = 'hourly' | 'flat';

export interface Rate {
  kind: RateKind;
  minor: number;
}

export interface OwnRate {
  person: string;
  job: string;
  rate: Rate;
}

export interface Changed {
  who: string | null;
  day: string | null;
  was: Rate | null;
  removed: boolean;
}

export interface RatesSample {
  plan: Plan;
  rates: Record<string, Rate | null>;
  own: OwnRate[];
  changed: Record<string, Changed>;
}

export const STAFF_RATES_STATES: readonly string[] = [
  'staff_rates',
  'staff_rates_no_rate',
  'staff_rates_change',
  'staff_rates_saved',
  'staff_rates_flat_fee',
  'staff_rates_flat_fee_open',
  'staff_rates_blank',
  'staff_rates_blank_fee',
  'staff_rates_negative',
  'staff_rates_decimals',
  'staff_rates_zero',
  'staff_rates_refused',
  'staff_rates_own',
  'staff_rates_add',
  'staff_rates_add_blank',
  'staff_rates_read_only',
  'staff_rates_empty',
];

const hourly = (minor: number): Rate => ({ kind: 'hourly', minor });
const flat = (minor: number): Rate => ({ kind: 'flat', minor });
const setBy = (who: string, day: string): Changed => ({ who, day, was: null, removed: false });

export function ratesSample(state = 'staff_rates'): RatesSample {
  const plan = samplePlan();
  const sample: RatesSample = {
    plan: state === 'staff_rates_empty' ? { ...plan, jobs: [], shifts: [] } : plan,
    rates: {
      lead: hourly(1800),
      waiter: hourly(1400),
      runner: state === 'staff_rates_no_rate' ? null : hourly(1200),
      cook: hourly(1600),
      bar: null,
      door: flat(12000),
      mc: flat(15000),
      security: hourly(1500),
    },
    own: [{ person: 'kunle', job: 'waiter', rate: hourly(1600) }],
    changed: {
      lead: setBy('Julien Moreau', '2026-10-16'),
      waiter: setBy('Julien Moreau', '2026-10-16'),
      runner: setBy('Julien Moreau', '2026-10-16'),
      cook: setBy('Folake Adeyemi', '2026-10-19'),
      door: setBy('Folake Adeyemi', '2026-10-19'),
      mc: setBy('Folake Adeyemi', '2026-10-19'),
      security: setBy('Julien Moreau', '2026-10-21'),
      'kunle:waiter': setBy('Folake Adeyemi', '2026-10-19'),
    },
  };
  if (state === 'staff_rates_saved') {
    sample.rates.waiter = hourly(1500);
    sample.changed.waiter = { who: null, day: null, was: hourly(1400), removed: false };
  }

  return sample;
}

const lengthOf = (shift: Shift) => shift.end - shift.start;
const openOf = (shift: Shift) => Math.max(0, shift.needed - shift.people.length);

export const shiftsFor = (plan: Plan, job: string) => plan.shifts.filter((one) => one.job === job);

/** Scheduled minutes: each shift's length once for every place it needs, a place nobody has taken yet included. */
export function scheduledMinutes(plan: Plan, job: string): number {
  return shiftsFor(plan, job).reduce((sum, one) => sum + lengthOf(one) * one.needed, 0);
}

export function openPlaces(plan: Plan, job: string): number {
  return shiftsFor(plan, job).reduce((sum, one) => sum + openOf(one), 0);
}

export function peopleOn(plan: Plan, job: string): string[] {
  return [...new Set(shiftsFor(plan, job).flatMap((one) => one.people))];
}

export function ownOf(sample: RatesSample, person: string, job: string): OwnRate | undefined {
  return sample.own.find((one) => one.person === person && one.job === job);
}

const costOf = (rate: Rate, minutes: number) =>
  rate.kind === 'hourly' ? Math.round((rate.minor * minutes) / 60) : rate.minor;

/** A job's cost at `rate`: hourly by each place's minutes, a flat fee once for each person and once for each open place; a person on their own rate is paid that instead. */
export function jobCost(sample: RatesSample, job: string, rate: Rate | null): number | null {
  if (rate == null) return null;
  const { plan } = sample;
  const own = peopleOn(plan, job).reduce((sum, person) => {
    const theirs = ownOf(sample, person, job);

    return sum + (theirs == null ? 0 : ownCost(sample, theirs));
  }, 0);
  if (rate.kind === 'flat') return own + feesAt(sample, job) * rate.minor;

  return own + costOf(rate, jobRateMinutes(sample, job));
}

export function jobRateMinutes(sample: RatesSample, job: string): number {
  return shiftsFor(sample.plan, job).reduce(
    (sum, one) =>
      sum +
      lengthOf(one) *
        (openOf(one) + one.people.filter((person) => ownOf(sample, person, job) == null).length),
    0,
  );
}

export function feesAt(sample: RatesSample, job: string): number {
  const people = peopleOn(sample.plan, job).filter((person) => ownOf(sample, person, job) == null);

  return people.length + openPlaces(sample.plan, job);
}

export function ownMinutes(sample: RatesSample, own: OwnRate): number {
  return shiftsFor(sample.plan, own.job)
    .filter((one) => one.people.includes(own.person))
    .reduce((sum, one) => sum + lengthOf(one), 0);
}

export function ownCost(sample: RatesSample, own: OwnRate): number {
  const minutes = ownMinutes(sample, own);
  if (own.rate.kind === 'flat') return minutes > 0 ? own.rate.minor : 0;

  return costOf(own.rate, minutes);
}

export interface Headline {
  total: number;
  counted: number;
  scheduled: number;
  unrated: { job: string; minutes: number }[];
}

/** Budget-A-Web's Staff line reads this same figure. */
export function headlineOf(sample: RatesSample): Headline {
  return sample.plan.jobs.reduce<Headline>(
    (sum, job) => {
      const minutes = scheduledMinutes(sample.plan, job.id);
      const rate = sample.rates[job.id] ?? null;
      const cost = jobCost(sample, job.id, rate);

      return {
        total: sum.total + (cost ?? 0),
        counted: sum.counted + (rate == null ? 0 : minutes),
        scheduled: sum.scheduled + minutes,
        unrated:
          rate == null && minutes > 0 ? [...sum.unrated, { job: job.id, minutes }] : sum.unrated,
      };
    },
    { total: 0, counted: 0, scheduled: 0, unrated: [] },
  );
}

export function hoursWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? W.hours(hours) : W.hoursMinutes(hours, rest);
}

export function figure(minor: number, currency = CURRENCY): string {
  return minor % 100 === 0 ? whole(minor, currency) : money(minor, currency);
}

export function rateText(rate: Rate): string {
  return rate.kind === 'hourly' ? W.anHour(figure(rate.minor)) : W.eachPerson(figure(rate.minor));
}

export function unratedLine(sample: RatesSample, head = headlineOf(sample)): string | null {
  if (head.unrated.length === 0) return null;
  const names = head.unrated.map((one) =>
    W.jobsHours(jobName(sample.plan, one.job), hoursWords(one.minutes)),
  );

  return W.notCounted(names, head.unrated.length);
}

export function headlineLine(sample: RatesSample, head = headlineOf(sample)): string {
  const from = W.from(hoursWords(head.counted), hoursWords(head.scheduled));
  const unrated = unratedLine(sample, head);

  return unrated == null ? from : `${from} ${unrated}`;
}

export function sourceLine(sample: RatesSample, job: string): string {
  const shifts = shiftsFor(sample.plan, job).length;
  if (shifts === 0) return W.noShifts;
  const hours = W.fromShifts(hoursWords(scheduledMinutes(sample.plan, job)), shifts);
  const open = openPlaces(sample.plan, job);

  return open === 0 ? hours : `${hours} · ${W.notFilled(open)}`;
}

export function flatLine(sample: RatesSample, job: string): string {
  const shifts = shiftsFor(sample.plan, job).length;
  if (shifts === 0) return W.noShifts;
  const people = peopleOn(sample.plan, job).length;
  const open = openPlaces(sample.plan, job);
  const parts = [W.fromShifts(hoursWords(scheduledMinutes(sample.plan, job)), shifts)];
  if (people > 0) parts.push(W.people(people));
  if (open > 0) parts.push(W.notFilled(open));

  return parts.join(' · ');
}

export function changedLine(changed: Changed | undefined): string | null {
  if (changed == null) return null;
  if (changed.who == null) {
    if (changed.was == null) return W.setByYou;

    return changed.removed
      ? W.removedByYou(rateText(changed.was))
      : W.changedByYou(rateText(changed.was));
  }
  const day = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${changed.day ?? ''}T00:00:00Z`));

  return W.setBy(changed.who, day);
}

export function insetWords(sample: RatesSample, job: string, rate: Rate | null): string | null {
  if (rate == null) return null;
  const { plan } = sample;
  const own = sample.own
    .filter((one) => one.job === job && peopleOn(plan, job).includes(one.person))
    .map((one) => personName(plan, one.person));
  const keeps = own.length === 0 ? '' : ` ${W.keepOwn(own)}`;
  if (rate.kind === 'hourly') {
    const minutes = jobRateMinutes(sample, job);

    return `${W.sum(hoursWords(minutes), figure(rate.minor), figure(costOf(rate, minutes)))}${keeps}`;
  }
  const fees = feesAt(sample, job);
  const parts = [W.sum(W.fees(fees), figure(rate.minor), figure(fees * rate.minor))];
  const twice = peopleOn(plan, job).filter(
    (person) => shiftsFor(plan, job).filter((one) => one.people.includes(person)).length > 1,
  );
  if (twice.length > 0) parts.push(W.oncePaid(twice.map((person) => personName(plan, person))));
  const open = openPlaces(plan, job);
  if (open > 0) parts.push(W.openFees(open));

  return `${parts.join(' ')}${keeps}`;
}

export type RateProblem = string | null;

export function rateProblem(typed: string, kind: RateKind, currency = CURRENCY): RateProblem {
  const found = typedMinor(typed, currency);
  if ('minor' in found) return null;
  const fee = kind === 'flat';
  if (found.wrong === 'blank') return fee ? W.blankFee : W.blankRate;
  if (found.wrong === 'decimals') return W.decimals(fee, exampleIn(12, currency));

  return found.wrong === 'negative' ? W.negative(fee) : W.notNumber(fee);
}

export function typedRate(typed: string, kind: RateKind, currency = CURRENCY): Rate | null {
  const found = typedMinor(typed, currency);

  return 'minor' in found ? { kind, minor: found.minor } : null;
}

export function typedOf(rate: Rate | null): string {
  if (rate == null) return '';

  return rate.minor % 100 === 0 ? String(rate.minor / 100) : (rate.minor / 100).toFixed(2);
}

export function whoCanHaveOwn(
  sample: RatesSample,
): { person: string; job: string; words: string }[] {
  return sample.plan.jobs.flatMap((job) =>
    peopleOn(sample.plan, job.id)
      .filter((person) => ownOf(sample, person, job.id) == null)
      .map((person) => ({
        person,
        job: job.id,
        words: W.whoOption(personName(sample.plan, person), job.name),
      })),
  );
}

export type Panel =
  | { kind: 'job'; job: string }
  | { kind: 'own'; person: string; job: string }
  | { kind: 'add' }
  | null;

export interface Draft {
  kind: RateKind;
  typed: string;
  who: string;
}

export interface RatesStart {
  sample: RatesSample;
  panel: Panel;
  draft: Draft;
  pressed: boolean;
  refuse: boolean;
  manages: boolean;
}

const draftOf = (rate: Rate | null, kind: RateKind = 'hourly'): Draft => ({
  kind: rate?.kind ?? kind,
  typed: typedOf(rate),
  who: '',
});

export function startOf(state: string, manages: boolean): RatesStart {
  const sample = ratesSample(state);
  const job = (id: string, typed?: string, kind?: RateKind): Partial<RatesStart> => {
    const rate = sample.rates[id] ?? null;
    const draft = draftOf(rate);

    return {
      panel: { kind: 'job', job: id },
      draft: { ...draft, kind: kind ?? draft.kind, typed: typed ?? draft.typed },
    };
  };
  const opened: Record<string, Partial<RatesStart>> = {
    staff_rates_change: job('waiter', '15'),
    staff_rates_flat_fee: job('door'),
    staff_rates_flat_fee_open: job('mc'),
    staff_rates_blank: { ...job('waiter', ''), pressed: true },
    staff_rates_blank_fee: { ...job('door', ''), pressed: true },
    staff_rates_negative: { ...job('waiter', '-14'), pressed: true },
    staff_rates_decimals: { ...job('waiter', '14.505'), pressed: true },
    staff_rates_zero: job('waiter', '0'),
    staff_rates_refused: { ...job('waiter', '15'), pressed: true, refuse: true },
    staff_rates_own: {
      panel: { kind: 'own', person: 'kunle', job: 'waiter' },
      draft: draftOf(hourly(1600)),
    },
    staff_rates_add: {
      panel: { kind: 'add' },
      draft: { kind: 'hourly', typed: '16', who: 'amina:waiter' },
    },
    staff_rates_add_blank: { panel: { kind: 'add' }, draft: draftOf(null), pressed: true },
  };

  return {
    sample,
    panel: null,
    draft: draftOf(null),
    pressed: false,
    refuse: false,
    manages: manages && state !== 'staff_rates_read_only',
    ...opened[state],
  };
}

export const refusedWords = (rate: Rate | null) =>
  W.refused(rate == null ? W.noRateYet : rateText(rate));

const at = budgetAt;

export const STAFF_RATES_PAGES: readonly DemoGroup[] = [
  {
    name: 'Staff rates (Budget-A-StaffRates, sc-101)',
    states: [
      { to: at('staff_rates'), name: 'In use: the headline, each job, people on their own rate' },
      { to: at('staff_rates_no_rate'), name: 'Two jobs with No rate yet, Set Bar’s rate next' },
      { to: at('staff_rates_empty'), name: 'No jobs on this event yet' },
      {
        to: at('staff_rates_read_only', { as: 'ana' }),
        name: 'Sees the budget, cannot manage it (as Ana)',
      },
      {
        to: at('staff_rates', { as: 'kemi' }),
        name: 'No budget permission: not available (as Kemi)',
      },
      { to: at('staff_line'), name: 'The Budget’s Staff line, which links here' },
    ],
  },
  {
    name: 'Changing a rate in place',
    states: [
      { to: at('staff_rates_change'), name: 'Waiter at £15 an hour, Kunle keeps his own' },
      { to: at('staff_rates_saved'), name: 'Saved: Changed by you just now' },
      { to: at('staff_rates_flat_fee'), name: 'A flat fee: Tolu on 2 shifts is one fee' },
      { to: at('staff_rates_flat_fee_open'), name: 'A flat fee with a shift nobody has taken' },
      { to: at('staff_rates_zero'), name: '0 is a rate' },
      { to: at('staff_rates_refused'), name: 'Not saved: Manage the budget was taken away' },
    ],
  },
  {
    name: 'Checked before sending',
    states: [
      { to: at('staff_rates_blank'), name: 'Blank rate an hour' },
      { to: at('staff_rates_blank_fee'), name: 'Blank fee for each person' },
      { to: at('staff_rates_negative'), name: 'Below 0' },
      { to: at('staff_rates_decimals'), name: 'Too many decimal places' },
    ],
  },
  {
    name: 'People on their own rate',
    states: [
      { to: at('staff_rates_own'), name: 'Kunle’s own rate opened, with Use Waiter’s rate' },
      { to: at('staff_rates_add'), name: 'Add one: Amina at £16 an hour' },
      { to: at('staff_rates_add_blank'), name: 'Add one, nothing chosen' },
    ],
  },
];
