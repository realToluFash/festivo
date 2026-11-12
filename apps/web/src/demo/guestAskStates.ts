/** sc-1363's states on the guest page, on its own clock: `?state=maybe_…`, with `&replyBy=`, `&days=` and `&save=` as the board's Tweaks. */

import { localDay, sampleEvent } from './events.ts';
import type { Visit } from './guest.ts';
import {
  type AskClock,
  type AskKey,
  type AskView,
  QUESTION,
  SAVE_FAILS,
  type SaveFail,
  askDay,
  offer,
} from './guestAsk.ts';
import type { DemoLink } from './settings.ts';
import { addDays } from './today.ts';

const EVENT = sampleEvent('evt-wed-4');
export const ASK_ZONE = EVENT?.timeZone ?? 'Europe/London';
export const START_DAY = localDay(EVENT?.startsAt ?? '2026-11-05T18:00:00Z', ASK_ZONE);

export const REPLY_BY_CHOICES = ['none', 'in12', 'in3', 'reopened', 'passed'] as const;
export type ReplyByChoice = (typeof REPLY_BY_CHOICES)[number];
export const DAYS_CHOICES = ['30', '12', '8', '7', '5'] as const;

export const REPLY_BY_NAMES: Record<ReplyByChoice, string> = {
  none: 'No Reply by',
  in12: 'Reply by in 12 days',
  in3: 'Reply by in 3 days',
  reopened: 'Reopened (Let them change their reply)',
  passed: 'Reply by passed',
};

const STATES = {
  maybe_recorded: 'Not sure yet, and the question',
  maybe_too_close: 'Not sure yet, no date qualifies, so no question',
  maybe_saving: 'Saving the choice',
  maybe_save_empty: 'Save with nothing chosen',
  maybe_save_empty_long: 'Save with nothing chosen, in French',
  maybe_ask_saved: 'A date saved',
  maybe_wont_ask: 'Don’t ask me again saved',
  maybe_not_saved: 'A save that doesn’t reach us',
  maybe_coming_back: 'Coming back, a date saved and not sent',
  maybe_coming_back_wont: 'Coming back, Don’t ask me again saved',
  maybe_coming_back_none: 'Coming back, nothing saved',
  maybe_coming_back_sent: 'Coming back, the ask sent or Not sent: too late',
  maybe_dates_moved: 'The 422, a date left',
  maybe_too_close_now: 'The 422, none left',
  maybe_reply_changed: 'The 409, answered on another device',
} as const;

export type AskState = keyof typeof STATES;

export function isAskState(value: string | null): value is AskState {
  return value != null && Object.hasOwn(STATES, value);
}

export function isReplyByChoice(value: string | null): value is ReplyByChoice {
  return value != null && (REPLY_BY_CHOICES as readonly string[]).includes(value);
}

const NEEDS_QUESTION: readonly AskState[] = [
  'maybe_saving',
  'maybe_save_empty',
  'maybe_save_empty_long',
  'maybe_ask_saved',
  'maybe_wont_ask',
  'maybe_not_saved',
];

/** The clock the page offers from: today in the event's zone, and Reply by unless the guest was reopened. */
export function askClock(visit: Pick<Visit, 'now' | 'replyBy' | 'reopened'>): AskClock {
  return {
    today: localDay(visit.now, ASK_ZONE),
    start: START_DAY,
    replyBy: visit.reopened ? null : visit.replyBy,
  };
}

const at = (day: string): string => `${day}T10:00:00Z`;

export function askFocus(key: AskKey): string {
  return `ask-${key}`;
}

export function askStarts(
  state: AskState,
  choice: ReplyByChoice = 'none',
  daysIn = 30,
): Partial<Visit> {
  const today = addDays(START_DAY, -daysIn);
  const replyBy =
    choice === 'in12' || choice === 'reopened' || choice === 'passed'
      ? addDays(today, 12)
      : choice === 'in3'
        ? addDays(today, 3)
        : null;
  const applies = choice === 'in12' || choice === 'in3' ? replyBy : null;
  const reopened = choice === 'reopened';
  const shared = { replyBy, reopened, lang: 'en' as const };

  if (choice === 'passed' && replyBy != null) {
    return {
      ...shared,
      now: at(addDays(replyBy, 1)),
      recorded: { answer: 'notSure', on: today },
      view: { kind: 'closed' },
      ask: null,
    };
  }

  const clockOn = (day: string): AskClock => ({ today: day, start: START_DAY, replyBy: applies });
  const dates = (day: string): AskKey[] => offer(clockOn(day)).filter((key) => key !== 'never');
  const has = (day: string): boolean => dates(day).length > 0;
  const first = (day: string): AskKey | null => {
    const all = dates(day);

    return all.includes('week') ? 'week' : (all[0] ?? null);
  };
  const last = (day: string): AskKey | null => dates(day).at(-1) ?? null;
  const dayOf = (key: AskKey | null, day: string): string | null =>
    key == null || key === 'never' ? null : askDay(key, clockOn(day));
  /** The first day, from today on, with no date though the day before had one: where the 422 finds none left. */
  const edge = (): string => {
    for (let ahead = 0; ahead < daysIn; ahead += 1) {
      const day = addDays(today, ahead);

      if (has(addDays(day, -1)) && !has(day)) return day;
    }

    return today;
  };
  const on = (day: string, ask: AskView | null, answered = day, want?: string): Partial<Visit> => ({
    ...shared,
    now: at(day),
    recorded: { answer: 'notSure', on: answered },
    view: { kind: 'recorded', same: false },
    ask,
    ...(want == null ? {} : { want }),
  });
  const closeNow = (day: string): Partial<Visit> =>
    on(day, { kind: 'closeNow' }, addDays(day, -1), 'askClose');
  const asked = has(today) || applies != null ? today : addDays(START_DAY, -30);

  if (NEEDS_QUESTION.includes(state) && !has(asked)) return on(today, QUESTION);

  switch (state) {
    case 'maybe_recorded':
      return on(today, QUESTION);
    case 'maybe_too_close':
      return on(has(today) ? (applies == null ? addDays(START_DAY, -7) : edge()) : today, QUESTION);
    case 'maybe_saving':
      return on(asked, { ...QUESTION, pick: first(asked), saving: true }, asked, 'askSave');
    case 'maybe_save_empty':
      return on(
        asked,
        { ...QUESTION, error: 'empty' },
        asked,
        askFocus(dates(asked)[0] ?? 'never'),
      );
    case 'maybe_save_empty_long':
      return {
        ...on(asked, { ...QUESTION, error: 'empty' }, asked, askFocus(dates(asked)[0] ?? 'never')),
        lang: 'fr',
      };
    case 'maybe_ask_saved': {
      const day = dayOf(last(asked), asked);

      return on(
        asked,
        day == null ? QUESTION : { kind: 'saved', day, live: true },
        asked,
        'askSaved',
      );
    }
    case 'maybe_wont_ask':
      return on(asked, { kind: 'wont', live: true }, asked, 'askSaved');
    case 'maybe_not_saved':
      return on(asked, { ...QUESTION, pick: first(asked), error: 'net' }, asked, 'askSave');
    case 'maybe_coming_back': {
      const answered = earlier(today);
      const day = dayOf(first(answered), answered);

      return on(
        today,
        day != null && day > today ? { kind: 'saved', day, live: false } : QUESTION,
        answered,
      );
    }
    case 'maybe_coming_back_wont':
      return on(today, { kind: 'wont', live: false }, earlier(today));
    case 'maybe_coming_back_none':
      return on(today, QUESTION, earlier(today));
    case 'maybe_coming_back_sent':
      return on(today, { kind: 'none' }, earlier(today));
    case 'maybe_dates_moved': {
      if (applies == null) {
        const day = addDays(START_DAY, -11);

        return on(day, { ...QUESTION, moved: true }, addDays(day, -1), 'askSave');
      }
      const next = addDays(today, 1);

      if (has(today) && has(next)) return on(next, { ...QUESTION, moved: true }, today, 'askSave');

      return closeNow(edge());
    }
    case 'maybe_too_close_now':
      return closeNow(applies == null ? addDays(START_DAY, -7) : edge());
    case 'maybe_reply_changed':
      return { ...on(asked, null, asked, 'greeting'), recorded: { answer: 'coming', on: asked } };
  }
}

/** Answered three days before today, and never later than ten days before the start. */
function earlier(today: string): string {
  const three = addDays(today, -3);
  const ten = addDays(START_DAY, -10);

  return three < ten ? three : ten;
}

const SAVE_NAMES: Record<SaveFail, string> = {
  net: 'Save doesn’t reach us the first time',
  moved: 'Save meets the 422 the first time, a date left',
  close: 'Save meets the 422 the first time, none left',
  changed: 'Save meets the 409 the first time',
};

function link(state: AskState, choice: ReplyByChoice = 'none'): DemoLink {
  const query = choice === 'none' ? '' : `&replyBy=${choice}`;
  const name = choice === 'none' ? STATES[state] : `${STATES[state]}, ${REPLY_BY_NAMES[choice]}`;

  return { to: `/demo/guest?state=${state}${query}`, name };
}

function saveLink(fail: SaveFail): DemoLink {
  return { to: `/demo/guest?state=maybe_recorded&save=${fail}`, name: SAVE_NAMES[fail] };
}

export const GUEST_ASK_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Choosing when, and saving',
    states: (
      [
        'maybe_recorded',
        'maybe_too_close',
        'maybe_saving',
        'maybe_save_empty',
        'maybe_save_empty_long',
        'maybe_ask_saved',
        'maybe_wont_ask',
        'maybe_not_saved',
      ] as const
    ).map((state) => link(state)),
  },
  {
    name: 'Coming back, and the refusals',
    states: (
      [
        'maybe_coming_back',
        'maybe_coming_back_wont',
        'maybe_coming_back_none',
        'maybe_coming_back_sent',
        'maybe_dates_moved',
        'maybe_too_close_now',
        'maybe_reply_changed',
      ] as const
    ).map((state) => link(state)),
  },
  {
    name: 'Save fails the first time, then goes through',
    states: SAVE_FAILS.map(saveLink),
  },
  {
    name: 'Reply by (sc-3780) bounds the ask',
    states: [
      link('maybe_recorded', 'in12'),
      link('maybe_recorded', 'in3'),
      link('maybe_recorded', 'reopened'),
      link('maybe_recorded', 'passed'),
      link('maybe_dates_moved', 'in12'),
      link('maybe_too_close_now', 'in12'),
      link('maybe_too_close_now', 'in3'),
    ],
  },
];
