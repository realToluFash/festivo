/** The Messages page's Automatic messages card (sc-3974, sc-4329's row): its rules and samples, shared word for word by the web's and the app's demos. */

export const AUTO_STATES = [
  'live',
  'draft',
  'publishLate',
  'oneOff',
  'noReplyBy',
  'unavailable',
  'nextNone',
  'nextOne',
  'loading',
  'confirmReminders',
  'confirmRemindersOne',
  'confirmBefore',
  'confirmBeforeOne',
] as const;

export type AutoStateName = (typeof AUTO_STATES)[number];

export const AUTO_STATE_WHAT: Record<AutoStateName, string> = {
  live: 'Live, both switched on',
  draft: 'A draft: both off, one line says why, and publishing switches them on',
  publishLate: 'Published 4 days before replies close: the 7-day reminder is skipped',
  oneOff: 'Reminders to answer switched off',
  noReplyBy: 'No reply-by date: Not sure yet guests are asked 14 days before the event',
  unavailable: 'No reply-by or picks-close date, 9 days to go: Reminders to answer is unavailable',
  nextNone: 'Everyone has replied: the next one goes to nobody',
  nextOne: 'One guest still owes a reply',
  loading: 'Loading',
  confirmReminders: 'Turning off Reminders to answer, many waiting',
  confirmRemindersOne: 'Turning off Reminders to answer, one waiting',
  confirmBefore: 'Turning off Before you come, many waiting',
  confirmBeforeOne: 'Turning off Before you come, one waiting',
};

export function autoStateOf(raw: string | null | undefined): AutoStateName {
  return AUTO_STATES.find((one) => one === raw) ?? 'live';
}

export type AutoKey = 'reminders' | 'before';

export const AUTO_KEYS: readonly AutoKey[] = ['reminders', 'before'];

export type Guest = {
  id: number;
  answer: 'none' | 'coming' | 'notComing' | 'notSure';
  namesOwed: boolean;
  mealsOwed: boolean;
};

export type Plan = {
  today: string;
  pastTen: boolean;
  eventDay: string;
  replyBy: string | null;
  /** Registered by sc-3905 once meal picks have a close date; null until then. */
  picksClose: string | null;
  published: boolean;
  guests: readonly Guest[];
};

export type AutoState = {
  plan: Plan;
  on: Record<AutoKey, boolean>;
  loading: boolean;
  confirm: AutoKey | null;
  said: string;
};

export const EVENT = 'Adaeze and Tobi’s wedding';
export const SEND_TIME = '10:00';
export const AT_MOST_PER_EVENT = 4;

export const AW = {
  title: 'Messages',
  allMessages: 'All messages',
  allMessagesLine: 'Every message sent for this event, newest first.',
  heading: 'Automatic messages',
  draft: 'These are off while the event is a draft, and turn on when you publish it.',
  footer:
    'Each guest gets these by the same channels as their invitation. Every message sent appears in All messages, with who it reached.',
  reminders: 'Reminders to answer',
  before: 'Before you come',
  remindersWhen:
    'To guests who still owe a reply, meal choices or names, 7 days and 1 day before each closes. Guests who answered Maybe are asked once more, 3 days before replies close.',
  remindersWhenNoDate:
    'To guests who still owe a reply, meal choices or names, 7 days and 1 day before each closes. Guests who answered Maybe are asked once more, 14 days before the event.',
  beforeWhen:
    'To guests who are coming, the day before the event. Anyone who says they are coming after that gets it too, before the event starts.',
  limit: 'At most one a day and four per event to each guest.',
  time: 'Sent at {time}, the event’s time.',
  unavailable: 'Set a reply-by date to use this.',
  next_one: 'Next on {date}, to 1 guest as things stand.',
  next_other: 'Next on {date}, to {count} guests as things stand.',
  nextNobody: 'Next on {date}, to nobody as things stand.',
  on: 'On',
  off: 'Off',
  loading: 'Loading automatic messages',
  remindersTitle: 'Turn off reminders to answer?',
  remindersBody_one: 'The message waiting to go is cancelled.',
  remindersBody_other: 'The {count} messages waiting to go are cancelled.',
  beforeTitle: 'Turn off Before you come?',
  beforeBody_one: '1 guest who is coming will not get it.',
  beforeBody_other: '{count} guests who are coming will not get it.',
  turnOff: 'Turn off',
  keepOn: 'Keep it on',
} as const;

/** Read out as a switch settles; proposed here, as no key says it yet. */
export const SAID_WORDS = {
  isOn: '{name} is on.',
  isOff: '{name} is off.',
  proposed: 'Words proposed for [en]',
} as const;

const fill = (words: string, values: Record<string, string | number>): string =>
  words.replace(/\{(\w+)\}/gu, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );

const DAY_MS = 86_400_000;

export function shifted(day: string, by: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
}

const DAY_WORDS = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function dayWords(day: string): string {
  return DAY_WORDS.format(new Date(`${day}T00:00:00Z`));
}

export type Due = 'reply' | 'notSure' | 'names' | 'meals';

type Planned = { day: string; due: Due; key: AutoKey };

const ahead = (plan: Plan, day: string): boolean =>
  day > plan.today || (day === plan.today && !plan.pastTen);

/** The dates each message is planned for, from the event's own dates. A date already passed when it is scheduled is not planned at all (pm, 28 Nov). */
export function planned(plan: Plan): Planned[] {
  const out: Planned[] = [];
  const add = (key: AutoKey, due: Due, day: string): void => {
    if (ahead(plan, day)) out.push({ day, due, key });
  };

  if (plan.replyBy != null) {
    for (const by of [7, 1]) {
      add('reminders', 'reply', shifted(plan.replyBy, -by));
      add('reminders', 'names', shifted(plan.replyBy, -by));
    }
    add('reminders', 'notSure', shifted(plan.replyBy, -3));
  } else {
    add('reminders', 'notSure', shifted(plan.eventDay, -14));
  }
  if (plan.picksClose != null) {
    for (const by of [7, 1]) add('reminders', 'meals', shifted(plan.picksClose, -by));
  }
  add('before', 'reply', shifted(plan.eventDay, -1));

  return out.sort((a, b) => a.day.localeCompare(b.day));
}

function owes(guest: Guest, due: Due, key: AutoKey): boolean {
  if (key === 'before') return guest.answer === 'coming';

  switch (due) {
    case 'reply':
      return guest.answer === 'none';
    case 'notSure':
      return guest.answer === 'notSure';
    case 'names':
      return guest.answer === 'coming' && guest.namesOwed;
    case 'meals':
      return guest.answer === 'coming' && guest.mealsOwed;
  }
}

export type Send = { day: string; guest: number; owed: Due[] };

const ORDER: readonly Due[] = ['reply', 'notSure', 'names', 'meals'];

/** Every send waiting for one message, its audience resolved against the guest list as it stands, collapsed, and capped at four per guest per event. */
export function waiting(plan: Plan, key: AutoKey): Send[] {
  const byDay = new Map<string, Map<number, Set<Due>>>();

  for (const one of planned(plan).filter((p) => p.key === key)) {
    const day = byDay.get(one.day) ?? new Map<number, Set<Due>>();
    for (const guest of plan.guests) {
      if (!owes(guest, one.due, key)) continue;
      const owed = day.get(guest.id) ?? new Set<Due>();
      owed.add(one.due);
      day.set(guest.id, owed);
    }
    byDay.set(one.day, day);
  }

  const sends: Send[] = [];
  const counted = new Map<number, number>();

  for (const [day, guests] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [guest, owed] of guests) {
      const sent = counted.get(guest) ?? 0;
      if (key === 'reminders' && sent >= AT_MOST_PER_EVENT) continue;
      counted.set(guest, sent + 1);
      sends.push({ day, guest, owed: ORDER.filter((due) => owed.has(due)) });
    }
  }

  return sends;
}

export function nextOf(plan: Plan, key: AutoKey): { day: string; count: number } | null {
  const first = planned(plan).find((p) => p.key === key);
  if (first == null) return null;

  return { day: first.day, count: waiting(plan, key).filter((s) => s.day === first.day).length };
}

export function nextLine(plan: Plan, key: AutoKey): string | null {
  const next = nextOf(plan, key);
  if (next == null) return null;
  const date = dayWords(next.day);
  if (next.count === 0) return fill(AW.nextNobody, { date });

  return fill(next.count === 1 ? AW.next_one : AW.next_other, { date, count: next.count });
}

/** From the event's dates alone, never from guests' answers (pm, 28 Nov): only with no reply-by date, no picks close, and the Not sure yet ask's date passed. */
export function unavailable(plan: Plan, key: AutoKey): boolean {
  return (
    key === 'reminders' &&
    plan.replyBy == null &&
    plan.picksClose == null &&
    !ahead(plan, shifted(plan.eventDay, -14))
  );
}

export type RowView = {
  key: AutoKey;
  name: string;
  when: string;
  limit: string | null;
  time: string;
  live: boolean;
  shownOn: boolean;
  next: string | null;
  unavailable: string | null;
};

export function rowOf(s: AutoState, key: AutoKey): RowView {
  const { plan } = s;
  const gone = unavailable(plan, key);
  const shownOn = plan.published && !gone && s.on[key];

  return {
    key,
    name: key === 'reminders' ? AW.reminders : AW.before,
    when:
      key === 'before'
        ? AW.beforeWhen
        : plan.replyBy == null
          ? AW.remindersWhenNoDate
          : AW.remindersWhen,
    limit: key === 'reminders' ? AW.limit : null,
    time: fill(AW.time, { time: SEND_TIME }),
    live: plan.published && !gone,
    shownOn,
    next: shownOn ? nextLine(plan, key) : null,
    unavailable: gone ? AW.unavailable : null,
  };
}

export const draftLine = (s: AutoState): string | null => (s.plan.published ? null : AW.draft);

export function press(s: AutoState, key: AutoKey): AutoState {
  if (!rowOf(s, key).live) return s;
  if (s.on[key])
    return waiting(s.plan, key).length > 0 ? { ...s, confirm: key } : turned(s, key, false);

  return turned(s, key, true);
}

function turned(s: AutoState, key: AutoKey, on: boolean): AutoState {
  const name = key === 'reminders' ? AW.reminders : AW.before;

  return {
    ...s,
    on: { ...s.on, [key]: on },
    confirm: null,
    said: fill(on ? SAID_WORDS.isOn : SAID_WORDS.isOff, { name }),
  };
}

export const confirmOff = (s: AutoState): AutoState =>
  s.confirm == null ? s : turned(s, s.confirm, false);

export const keepOn = (s: AutoState): AutoState => ({ ...s, confirm: null });

export function confirmWords(s: AutoState): { title: string; body: string } | null {
  if (s.confirm == null) return null;
  const count = waiting(s.plan, s.confirm).length;

  if (s.confirm === 'reminders')
    return {
      title: AW.remindersTitle,
      body: count === 1 ? AW.remindersBody_one : fill(AW.remindersBody_other, { count }),
    };

  return {
    title: AW.beforeTitle,
    body: count === 1 ? AW.beforeBody_one : fill(AW.beforeBody_other, { count }),
  };
}

/** Publishing the event: both switches turn on, and only dates still ahead are planned. Demo only; the event's own Make live publishes it. */
export function publish(s: AutoState): AutoState {
  return {
    ...s,
    plan: { ...s.plan, published: true },
    on: { reminders: true, before: true },
    said: `${AW.reminders} and ${AW.before} are on.`,
  };
}

function guests(spec: readonly [Guest['answer'], number, Partial<Guest>?][]): Guest[] {
  const out: Guest[] = [];
  for (const [answer, count, extra] of spec) {
    for (let i = 0; i < count; i += 1)
      out.push({ id: out.length + 1, answer, namesOwed: false, mealsOwed: false, ...extra });
  }

  return out;
}

/** 80 invited: 61 still to reply, 3 Not sure yet, 4 not coming, 12 coming, 2 of whom still owe their party's names. */
const GUESTS = guests([
  ['none', 61],
  ['notSure', 3],
  ['notComing', 4],
  ['coming', 2, { namesOwed: true }],
  ['coming', 10],
]);

const PLAN: Plan = {
  today: '2026-11-28',
  pastTen: true,
  eventDay: '2026-12-19',
  replyBy: '2026-12-11',
  picksClose: null,
  published: true,
  guests: GUESTS,
};

export function seed(name: AutoStateName): AutoState {
  const base: AutoState = {
    plan: PLAN,
    on: { reminders: true, before: true },
    loading: false,
    confirm: null,
    said: '',
  };

  switch (name) {
    case 'draft':
      return {
        ...base,
        plan: { ...PLAN, published: false },
        on: { reminders: false, before: false },
      };
    case 'publishLate':
      return {
        ...base,
        plan: { ...PLAN, today: '2026-12-07', published: false },
        on: { reminders: false, before: false },
      };
    case 'oneOff':
      return { ...base, on: { reminders: false, before: true } };
    case 'noReplyBy':
      return { ...base, plan: { ...PLAN, replyBy: null } };
    case 'unavailable':
      return { ...base, plan: { ...PLAN, replyBy: null, today: '2026-12-10' } };
    case 'nextNone':
      return {
        ...base,
        plan: {
          ...PLAN,
          guests: guests([
            ['coming', 70],
            ['notComing', 10],
          ]),
        },
      };
    case 'nextOne':
      return {
        ...base,
        plan: {
          ...PLAN,
          guests: guests([
            ['none', 1],
            ['coming', 69],
            ['notComing', 10],
          ]),
        },
      };
    case 'loading':
      return { ...base, loading: true };
    case 'confirmReminders':
      return { ...base, confirm: 'reminders' };
    case 'confirmRemindersOne': {
      const one = seed('nextOne');
      return press({ ...one, plan: { ...one.plan, today: '2026-12-09' } }, 'reminders');
    }
    case 'confirmBefore':
      return { ...base, confirm: 'before' };
    case 'confirmBeforeOne':
      return press(
        {
          ...base,
          plan: {
            ...PLAN,
            guests: guests([
              ['coming', 1],
              ['notComing', 79],
            ]),
          },
        },
        'before',
      );
    case 'live':
      return base;
  }
}
