/** Budget / Staff rates (sc-101): what each job's scheduled hours cost at its rate or flat fee, in the event's currency, as the API's decimal strings. */

export type StaffRateKind = 'hourly' | 'flat';

export interface StaffRate {
  kind: StaffRateKind;
  amount: string;
}

export interface StaffRateChanged {
  by: string | null;
  at: string;
}

export interface StaffNamed {
  id: string;
  name: string;
}

export interface StaffUnrated {
  job: StaffNamed;
  minutes: number;
}

/** The Staff rates headline, which the Budget's Staff line also reads. */
export interface StaffHeadline {
  total: string;
  countedMinutes: number;
  scheduledMinutes: number;
  unrated: StaffUnrated[];
}

export interface StaffRateJob {
  id: string;
  name: string;
  rate: StaffRate | null;
  changed: StaffRateChanged | null;
  scheduledMinutes: number;
  shifts: number;
  openPlaces: number;
  people: number;
  cost: string | null;
  rateMinutes: number;
  fees: number;
  paidOnce: string[];
  keepOwn: string[];
}

export interface StaffOwnRate {
  member: StaffNamed;
  job: StaffNamed;
  rate: StaffRate;
  changed: StaffRateChanged | null;
  minutes: number;
  cost: string;
}

export interface StaffRates {
  currency: string;
  headline: StaffHeadline;
  jobs: StaffRateJob[];
  own: StaffOwnRate[];
  /** People on this event's shifts with no rate of their own; `minutes` are their scheduled minutes in their job. */
  candidates: { member: StaffNamed; job: StaffNamed; minutes: number }[];
}

/** What a rate's change sends; the API checks the amount against the event's currency. */
export interface StaffRateTyped {
  kind: StaffRateKind;
  amount: string;
  currency: string;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const whole = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const names = (value: unknown): string[] =>
  list(value).filter((one): one is string => typeof one === 'string');

function asNamed(value: unknown): StaffNamed {
  const one = record(value);

  return { id: text(one.id), name: text(one.name) };
}

function asRate(value: unknown): StaffRate | null {
  const one = record(value);
  if (one.kind !== 'hourly' && one.kind !== 'flat') return null;

  return { kind: one.kind, amount: text(one.amount) || '0' };
}

function asChanged(value: unknown): StaffRateChanged | null {
  const one = record(value);
  if (typeof one.at !== 'string') return null;

  return { by: typeof one.by === 'string' ? one.by : null, at: one.at };
}

export function asStaffHeadline(value: unknown): StaffHeadline {
  const one = record(value);

  return {
    total: text(one.total) || '0',
    countedMinutes: whole(one.countedMinutes),
    scheduledMinutes: whole(one.scheduledMinutes),
    unrated: list(one.unrated).map((each) => {
      const unrated = record(each);

      return { job: asNamed(unrated.job), minutes: whole(unrated.minutes) };
    }),
  };
}

function asJob(value: unknown): StaffRateJob {
  const one = record(value);

  return {
    id: text(one.id),
    name: text(one.name),
    rate: asRate(one.rate),
    changed: asChanged(one.changed),
    scheduledMinutes: whole(one.scheduledMinutes),
    shifts: whole(one.shifts),
    openPlaces: whole(one.openPlaces),
    people: whole(one.people),
    cost: typeof one.cost === 'string' ? one.cost : null,
    rateMinutes: whole(one.rateMinutes),
    fees: whole(one.fees),
    paidOnce: names(one.paidOnce),
    keepOwn: names(one.keepOwn),
  };
}

function asOwn(value: unknown): StaffOwnRate | null {
  const one = record(value);
  const rate = asRate(one.rate);
  if (rate == null) return null;

  return {
    member: asNamed(one.member),
    job: asNamed(one.job),
    rate,
    changed: asChanged(one.changed),
    minutes: whole(one.minutes),
    cost: text(one.cost) || '0',
  };
}

export function asStaffRates(value: unknown): StaffRates {
  const body = record(value);

  return {
    currency: text(body.currency),
    headline: asStaffHeadline(body.headline),
    jobs: list(body.jobs).map(asJob),
    own: list(body.own)
      .map(asOwn)
      .filter((one): one is StaffOwnRate => one != null),
    candidates: list(body.candidates).map((each) => {
      const one = record(each);

      return { member: asNamed(one.member), job: asNamed(one.job), minutes: whole(one.minutes) };
    }),
  };
}
