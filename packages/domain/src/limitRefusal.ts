import { ApiError } from '@soirely/api-client';

import { type Translate } from './eventWords.ts';

/** Where the work met the limit, which picks the safe line and the way back. */
export type LimitMetAt = 'makeLive' | 'guestAdded' | 'seatInvite' | 'seatAccept' | 'copy';

/** The free ways past, before the way back. Change plan and Ask an owner are sc-100169's. */
export type LimitWay = 'removeGuest' | 'withdraw' | 'removeMember';

/** sc-3930's refusal in its order: what happened, what is safe, the ways past, and the one way back. */
export interface LimitRefusal {
  title: string;
  line: string | null;
  figure: string | null;
  safe: string;
  /** The live-events line, naming the counted event whose end comes first. */
  goLive: string | null;
  ways: readonly LimitWay[];
  /** The copy's one way past, a line with no button. */
  untick: string | null;
  /** A plan limit a member met, so the app tells one with billing.manage that the plan cannot be changed there; an invitee holds no permission yet. */
  planLimit: boolean;
  back: string;
}

const BACK: Record<LimitMetAt, string> = {
  makeLive: 'limitReached.back.draft',
  guestAdded: 'limitReached.back.form',
  seatInvite: 'limitReached.back.invitation',
  seatAccept: 'limitReached.back.notNow',
  copy: 'limitReached.back.form',
};

const SAFE: Record<LimitMetAt, string> = {
  makeLive: 'limitReached.safe.draft',
  guestAdded: 'limitReached.safe.form',
  seatInvite: 'limitReached.safe.invitation',
  seatAccept: 'limitReached.safe.accept',
  copy: 'limitReached.safe.form',
};

/** The end of the event the limit frees first, as the AC writes it: the event's own zone, in the client's `dateLocale`. */
export function endWords(
  endsAt: string,
  timeZone: string,
  dateLocale: string,
): { date: string; time: string } {
  const at = new Date(endsAt);
  const date = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(at);
  const time = new Intl.DateTimeFormat(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);

  return { date, time };
}

function planNameOf(key: string | undefined): string {
  const plan = key ?? '';

  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** The refusal for a `plan_limit_reached` or `event_capacity_reached` problem met at `at`; null for any other error. */
export function limitRefusalOf(
  error: unknown,
  at: LimitMetAt,
  t: Translate,
  dateLocale: string,
): LimitRefusal | null {
  if (!(error instanceof ApiError)) return null;

  const problem = error.problem;
  const base = { safe: t(SAFE[at]), back: t(BACK[at]), goLive: null, untick: null };

  if (error.is('event_capacity_reached')) {
    const ceiling = problem.ceiling ?? 0;
    const adding = problem.adding ?? 0;
    const onEvent = problem.onEvent ?? 0;

    if (at === 'copy') {
      return {
        ...base,
        title: t('limitReached.title.ceiling', { ceiling }),
        line: t('limitReached.copy.overCeiling', { count: adding, ceiling }),
        figure: t('limitReached.copy.figureCeiling', { count: adding }),
        ways: [],
        untick: t('limitReached.copy.untick'),
        planLimit: false,
      };
    }

    return {
      ...base,
      title: t('limitReached.title.ceiling', { ceiling }),
      line: t('limitReached.guestFull', { count: onEvent }),
      figure: t('limitReached.figure.ceiling', { count: onEvent, ceiling }),
      ways: ['removeGuest'],
      planLimit: false,
    };
  }

  if (!error.is('plan_limit_reached')) return null;

  const plan = planNameOf(problem.plan);
  const used = problem.used ?? 0;
  const allowed = problem.allowed ?? 0;

  if (at === 'seatAccept') {
    return {
      ...base,
      title: t('limitReached.title.accept', { organisation: problem.organisation ?? '' }),
      line: null,
      figure: null,
      ways: [],
      planLimit: false,
    };
  }

  if (at === 'seatInvite') {
    return {
      ...base,
      title: t('limitReached.title.seats', { count: allowed }),
      line: null,
      figure: t('limitReached.figure.seats', { count: used, allowed, plan }),
      ways: ['withdraw', 'removeMember'],
      planLimit: true,
    };
  }

  if (at === 'makeLive') {
    const first = problem.event;
    const end = first == null ? null : endWords(first.endsAt, first.timeZone, dateLocale);

    return {
      ...base,
      title: t('limitReached.title.live', { count: allowed }),
      line: null,
      figure: t('limitReached.figure.live', { count: used, allowed, plan }),
      goLive:
        first == null || end == null
          ? null
          : t('limitReached.goLive', { event: first.name, date: end.date, time: end.time }),
      ways: [],
      planLimit: true,
    };
  }

  if (at === 'copy') {
    const adding = problem.adding ?? 0;

    return {
      ...base,
      title: t('limitReached.title.people', { count: allowed }),
      line: t('limitReached.copy.overPlan', { count: adding, limit: allowed }),
      figure: t('limitReached.copy.figurePlan', { count: adding, plan }),
      ways: [],
      untick: t('limitReached.copy.untick'),
      planLimit: true,
    };
  }

  return {
    ...base,
    title: t('limitReached.title.people', { count: allowed }),
    line: t('limitReached.guestFull', { count: used }),
    figure: t('limitReached.figure.people', { count: used, allowed, plan }),
    ways: ['removeGuest'],
    planLimit: true,
  };
}
