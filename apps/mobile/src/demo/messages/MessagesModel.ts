import {
  ANSWERS,
  BALANCE,
  BODY,
  CANT_TELL,
  type GuestKey,
  type ManyKey,
  NOW,
  READER,
  SUBJECT,
  TO_FIGURES,
  TELL,
  TO_WORD,
  type ToGroup,
  formatCount,
} from './MessagesSample.ts';
import { type ChannelKey, W, say } from './MessagesWords.ts';

/** Every state of Messaging B, each a `?state=` in both demos (spec §7), in the spec's order. */
export const MESSAGES_STATES = [
  'first',
  'loading',
  'inUse',
  'conversation',
  'replyArrived',
  'answered',
  'channelReply',
  'to',
  'write',
  'preview',
  'check',
  'countdown',
  'cancelled',
  'sending',
  'sent',
  'failed',
  'reached',
  'fix',
  'resend',
  'tell',
  'untold',
  'invited',
  'scheduled',
  'bell',
] as const;

export type MessagesState = (typeof MESSAGES_STATES)[number];

export function messagesStateOf(value: string | undefined): MessagesState | null {
  return MESSAGES_STATES.find((state) => state === value) ?? null;
}

export type Open =
  | { kind: 'guest'; key: GuestKey }
  | { kind: 'many'; key: ManyKey }
  | { kind: 'draft' }
  | { kind: 'reached' }
  | null;

export type Step = 'write' | 'preview' | 'check' | 'countdown' | 'sending' | 'sent' | 'failed';

export const COUNTDOWN_SECONDS = 10;

export interface Draft {
  to: ToGroup;
  channels: Record<ChannelKey, boolean>;
  subject: string;
  body: string;
  step: Step;
  seconds: number;
  wait: number | null;
  cancelled: boolean;
}

/** A conversation of the hosts' own messages: `base` is the sample message it follows up, `earlier` what it already sent. */
export interface Thread {
  id: string;
  base: ManyKey | null;
  earlier: readonly Draft[];
}

export interface Kept extends Thread {
  draft: Draft;
}

export interface TellChange {
  lines: readonly string[];
  what: readonly string[];
}

export const SENDING_SECONDS = 3;

export interface Answer {
  text: string;
  time: string;
  seen: string | null;
}

export interface Messages {
  phase: 'loading' | 'first' | 'list';
  open: Open;
  thread: Thread | null;
  draft: Draft | null;
  kept: readonly Kept[];
  made: number;
  picking: boolean;
  arrived: boolean;
  done: readonly GuestKey[];
  doneAt: Partial<Record<GuestKey, string>>;
  answers: Partial<Record<GuestKey, Answer>>;
  typed: Partial<Record<GuestKey, string>>;
  untold: boolean;
  telling: boolean;
  change: TellChange;
  fixing: boolean;
  resending: boolean;
  bell: boolean;
  told: string | null;
}

const NEW_THREAD: Thread = { id: 'new-1', base: null, earlier: [] };

const BASE: Messages = {
  phase: 'list',
  open: null,
  thread: null,
  draft: null,
  kept: [],
  made: 1,
  picking: false,
  arrived: false,
  done: [],
  doneAt: {},
  answers: {},
  typed: {},
  untold: false,
  telling: false,
  change: { lines: [say.startMoved(TELL.now, TELL.was)], what: [W.newStartTime] },
  fixing: false,
  resending: false,
  bell: false,
  told: null,
};

export function blankDraft(): Draft {
  return {
    to: 'all',
    channels: { email: true, sms: true, wa: false },
    subject: '',
    body: '',
    step: 'write',
    seconds: COUNTDOWN_SECONDS,
    wait: null,
    cancelled: false,
  };
}

export function sampleDraft(step: Step = 'write'): Draft {
  return { ...blankDraft(), to: 'coming', subject: SUBJECT, body: BODY, step };
}

const DRAFTED: Partial<Record<MessagesState, Step>> = {
  to: 'write',
  write: 'write',
  preview: 'preview',
  check: 'check',
  countdown: 'countdown',
  cancelled: 'write',
  sending: 'sending',
  sent: 'sent',
  failed: 'failed',
};

/** Where a `?state=` opens; `wide` is the iPad, where a conversation stays open beside the list. */
export function startOf(state: MessagesState | null, wide: boolean): Messages {
  const step = state == null ? undefined : DRAFTED[state];
  if (step != null)
    return {
      ...BASE,
      open: { kind: 'draft' },
      picking: state === 'to',
      thread: NEW_THREAD,
      draft: { ...sampleDraft(step), cancelled: state === 'cancelled' },
      told: state === 'cancelled' && !wide ? W.cancelled : null,
    };
  const ines: Open = { kind: 'guest', key: 'ines' };

  switch (state) {
    case 'first':
      return { ...BASE, phase: 'first' };
    case 'loading':
      return { ...BASE, phase: 'loading' };
    case 'conversation':
      return { ...BASE, open: ines };
    case 'replyArrived':
      return {
        ...BASE,
        arrived: true,
        open: wide ? ines : null,
        told: say.arrived('Lucía Ortega'),
      };
    case 'answered':
      return {
        ...BASE,
        open: ines,
        done: ['ines'],
        doneAt: { ines: '09:20' },
        answers: { ines: { text: ANSWERS.ines ?? '', time: '09:20', seen: '09:31' } },
      };
    case 'channelReply':
      return {
        ...BASE,
        open: { kind: 'guest', key: 'kwame' },
        typed: { kwame: ANSWERS.kwame ?? '' },
      };
    case 'reached':
      return { ...BASE, open: { kind: 'reached' } };
    case 'fix':
      return { ...BASE, open: { kind: 'reached' }, fixing: true };
    case 'resend':
      return { ...BASE, open: { kind: 'many', key: 'parking' }, resending: true };
    case 'tell':
      return { ...BASE, telling: true };
    case 'untold':
      return { ...BASE, untold: true, open: wide ? ines : null };
    case 'invited':
      return { ...BASE, open: { kind: 'many', key: 'invite' } };
    case 'scheduled':
      return { ...BASE, open: { kind: 'many', key: 'sched' } };
    case 'bell':
      return { ...BASE, bell: true, open: wide ? ines : null };
    default:
      return BASE;
  }
}

export type Action =
  | { type: 'open'; open: Open }
  | { type: 'back' }
  | { type: 'newMessage' }
  | { type: 'followUp'; base: ManyKey | null }
  | { type: 'openThread'; id: string }
  | { type: 'picking'; open: boolean }
  | { type: 'chooseTo'; to: ToGroup }
  | { type: 'channel'; key: ChannelKey }
  | { type: 'subject'; text: string }
  | { type: 'body'; text: string }
  | { type: 'preview' }
  | { type: 'edit' }
  | { type: 'send' }
  | { type: 'changeIt' }
  | { type: 'confirm' }
  | { type: 'tick' }
  | { type: 'cancelCountdown' }
  | { type: 'retry' }
  | { type: 'answer'; key: GuestKey; text: string }
  | { type: 'markDone'; key: GuestKey }
  | { type: 'markWaiting'; key: GuestKey }
  | { type: 'telling'; open: boolean }
  | { type: 'offerTell'; change: TellChange }
  | { type: 'notNow' }
  | { type: 'tellSent' }
  | { type: 'dismissUntold' }
  | { type: 'fixing'; open: boolean }
  | { type: 'fixed' }
  | { type: 'resending'; open: boolean }
  | { type: 'resent' }
  | { type: 'bell'; open: boolean }
  | { type: 'told'; words: string | null };

function withDraft(m: Messages, change: (draft: Draft) => Draft): Messages {
  return m.draft == null ? m : { ...m, draft: change(m.draft) };
}

function stepped(m: Messages, from: readonly Step[], step: Step): Messages {
  return withDraft(m, (draft) => (from.includes(draft.step) ? { ...draft, step } : draft));
}

export function canSend(draft: Draft): boolean {
  return draft.body.trim() !== '';
}

export function writing(draft: Draft): boolean {
  return ['write', 'preview', 'check'].includes(draft.step);
}

export function onItsWay(draft: Draft): boolean {
  return draft.step === 'countdown' || (draft.step === 'sending' && draft.wait != null);
}

export function tickDraft(draft: Draft): Draft {
  if (draft.step === 'countdown') {
    const seconds = Math.max(draft.seconds - 1, 0);

    return seconds === 0
      ? { ...draft, seconds, step: 'sending', wait: SENDING_SECONDS }
      : { ...draft, seconds };
  }
  if (draft.step === 'sending' && draft.wait != null)
    return draft.wait <= 1
      ? { ...draft, step: 'sent', wait: null }
      : { ...draft, wait: draft.wait - 1 };

  return draft;
}

function park(m: Messages): Messages {
  if (m.thread == null || m.draft == null) return { ...m, thread: null, draft: null };

  return { ...m, thread: null, draft: null, kept: [{ ...m.thread, draft: m.draft }, ...m.kept] };
}

function activate(m: Messages, find: (kept: Kept) => boolean): Messages {
  const target = m.kept.find(find);
  if (target == null) return m;
  const parked = park({ ...m, kept: m.kept.filter((kept) => kept !== target) });
  const { draft, ...thread } = target;

  return { ...parked, thread, draft };
}

function opened(m: Messages, open: Open): Messages {
  const base = open?.kind === 'many' ? open.key : open?.kind === 'reached' ? 'parking' : null;
  const next = { ...m, open, picking: false };

  return base != null && m.thread?.base !== base
    ? activate(next, (kept) => kept.base === base)
    : next;
}

function fresh(
  m: Messages,
  base: ManyKey | null,
  to: ToGroup,
  channels?: Draft['channels'],
): Messages {
  const parked = park(m);
  const made = m.made + 1;

  return {
    ...parked,
    made,
    thread: { id: base ?? `new-${made}`, base, earlier: [] },
    draft: { ...blankDraft(), to, ...(channels == null ? {} : { channels }) },
  };
}

/** Write a follow-up: the sent message stays, and the next one is written after it, to the same people. */
function followedUp(m: Messages, base: ManyKey | null): Messages {
  const here = m.thread?.base === base ? m : activate(m, (kept) => kept.base === base);
  if (here.thread?.base !== base || here.draft == null)
    return base == null ? m : fresh(here, base, 'all');
  if (here.draft.step !== 'sent') return here;

  return {
    ...here,
    thread: { ...here.thread, earlier: [...here.thread.earlier, here.draft] },
    draft: { ...blankDraft(), to: here.draft.to, channels: here.draft.channels },
  };
}

export function reduce(m: Messages, action: Action): Messages {
  switch (action.type) {
    case 'open':
      return opened(m, action.open);
    case 'back':
      return opened(m, m.open?.kind === 'reached' ? { kind: 'many', key: 'parking' } : null);
    case 'newMessage': {
      const keep =
        m.thread?.base == null && m.draft != null && (writing(m.draft) || onItsWay(m.draft));
      const next = keep ? m : fresh(m, null, 'all');

      return { ...next, open: { kind: 'draft' }, picking: false };
    }
    case 'followUp':
      return followedUp(m, action.base);
    case 'openThread': {
      const next = m.thread?.id === action.id ? m : activate(m, (kept) => kept.id === action.id);

      return { ...next, open: { kind: 'draft' }, picking: false };
    }
    case 'picking':
      return { ...m, picking: action.open };
    case 'chooseTo':
      return { ...withDraft(m, (draft) => ({ ...draft, to: action.to })), picking: false };
    case 'channel':
      return withDraft(m, (draft) => ({
        ...draft,
        channels: { ...draft.channels, [action.key]: !draft.channels[action.key] },
      }));
    case 'subject':
      return withDraft(m, (draft) => ({ ...draft, subject: action.text }));
    case 'body':
      return withDraft(m, (draft) => ({ ...draft, body: action.text, cancelled: false }));
    case 'preview':
      return stepped(m, ['write'], 'preview');
    case 'edit':
      return stepped(m, ['preview'], 'write');
    case 'send':
      return m.draft != null && canSend(m.draft) ? stepped(m, ['write', 'preview'], 'check') : m;
    case 'changeIt':
      return stepped(m, ['check'], 'write');
    case 'confirm':
      return withDraft(m, (draft) =>
        draft.step === 'check'
          ? { ...draft, step: 'countdown', seconds: COUNTDOWN_SECONDS, cancelled: false }
          : draft,
      );
    case 'tick':
      return {
        ...withDraft(m, tickDraft),
        kept: m.kept.map((kept) => ({ ...kept, draft: tickDraft(kept.draft) })),
      };
    case 'cancelCountdown':
      return withDraft(m, (draft) =>
        draft.step === 'countdown' ? { ...draft, step: 'write', cancelled: true } : draft,
      );
    case 'retry':
      return withDraft(m, (draft) =>
        draft.step === 'failed' ? { ...draft, step: 'sending', wait: SENDING_SECONDS } : draft,
      );
    case 'answer':
      return {
        ...m,
        answers: { ...m.answers, [action.key]: { text: action.text, time: NOW, seen: null } },
        typed: { ...m.typed, [action.key]: '' },
      };
    case 'markDone':
      return {
        ...m,
        done: [action.key, ...m.done.filter((key) => key !== action.key)],
        doneAt: { ...m.doneAt, [action.key]: m.answers[action.key]?.time ?? NOW },
      };
    case 'markWaiting':
      return { ...m, done: m.done.filter((key) => key !== action.key) };
    case 'telling':
      return { ...m, telling: action.open };
    case 'offerTell':
      return { ...m, telling: true, change: action.change };
    case 'notNow':
      return { ...m, telling: false, untold: true };
    case 'tellSent':
      return { ...m, telling: false, untold: false };
    case 'dismissUntold':
      return { ...m, untold: false };
    case 'fixing':
      return { ...m, fixing: action.open };
    case 'fixed':
      return { ...m, fixing: false, told: W.saved };
    case 'resending':
      return { ...m, resending: action.open };
    case 'resent':
      return { ...m, resending: false };
    case 'bell':
      return { ...m, bell: action.open };
    case 'told':
      return { ...m, told: action.words };
  }
}

export type RowKey = { kind: 'guest'; key: GuestKey } | { kind: 'many'; key: ManyKey };

export interface Sections {
  needs: readonly RowKey[];
  scheduled: readonly RowKey[];
  done: readonly RowKey[];
}

const guest = (key: GuestKey): RowKey => ({ kind: 'guest', key });
const many = (key: ManyKey): RowKey => ({ kind: 'many', key });

/** Needs you, Scheduled and Done; a guest marked done moves to the top of Done, and comes back when marked waiting. */
export function sectionsOf(m: Messages): Sections {
  const waiting: GuestKey[] = m.arrived ? ['lucia', 'ines', 'kwame'] : ['ines', 'lucia', 'kwame'];

  return {
    needs: [
      ...waiting.filter((key) => !m.done.includes(key)).map(guest),
      guest('unknown'),
      many('parking'),
    ],
    scheduled: [many('sched')],
    done: [...m.done.filter((key) => key !== 'marta').map(guest), guest('marta'), many('invite')],
  };
}

/** The badge on Messages: the guests waiting and the senders not matched, added together (sc-3976). */
export function badgeOf(
  m: Messages,
): { waiting: number; notMatched: number; total: number } | null {
  if (m.phase !== 'list') return null;
  const waiting =
    (['ines', 'lucia', 'kwame'] as const).filter((key) => !m.done.includes(key)).length +
    (m.arrived ? 1 : 0);

  return { waiting, notMatched: 1, total: waiting + 1 };
}

export interface Check {
  count: number;
  told: readonly { key: ChannelKey; count: number }[];
  cantTell: number;
  names: readonly string[];
  seeAll: boolean;
  credits: number;
  after: string;
  whatsApp: boolean;
}

export function checkOf(draft: Draft): Check {
  const figures = TO_FIGURES[draft.to];
  const ticked = (['email', 'sms', 'wa'] as const).filter((key) => draft.channels[key]);
  const credits = (draft.channels.sms ? figures.sms : 0) + (draft.channels.wa ? figures.wa : 0);

  return {
    count: figures.count,
    told: ticked.map((key) => ({ key, count: figures[key] })),
    cantTell: figures.cantTell,
    names: CANT_TELL.slice(0, Math.min(figures.cantTell, CANT_TELL.length)),
    seeAll: figures.cantTell > CANT_TELL.length,
    credits,
    after: formatCount(BALANCE - credits),
    whatsApp: draft.channels.wa,
  };
}

export function toChip(to: ToGroup): string {
  return say.chip(TO_WORD[to], TO_FIGURES[to].count);
}

export function resultOf(draft: Draft): {
  count: number;
  reached: number;
  soFar: number;
  seen: number;
} {
  const { count, cantTell } = TO_FIGURES[draft.to];

  return { count, reached: count - cantTell, soFar: Math.round(count * 0.4), seen: 3 };
}

/** The countdown is said only at 10, 5 and 0, never every second (WCAG 2.2 SC 4.1.3); at 0 it says the message is queued. */
export function spokenAt(seconds: number, count: number): string | null {
  if (seconds === COUNTDOWN_SECONDS || seconds === 5) return say.sendingIn(seconds);
  if (seconds === 0) return say.queued(count);

  return null;
}

/** A message's name in Messages: its Subject, or with none its first line, which the screen shortens to fit (pm, sc-3942). */
export function messageName(draft: Draft): string {
  return draft.subject.trim() || (draft.body.trim().split(/\r?\n/u)[0] ?? '').trim();
}

export function draftTitle(draft: Draft, thread: Thread | null = null): string {
  const first = thread?.earlier[0];
  if (first != null) return messageName(first);

  return writing(draft) ? W.newMessage : messageName(draft);
}

export function anyOnItsWay(m: Messages): boolean {
  return [m.draft, ...m.kept.map((kept) => kept.draft)].some(
    (draft) => draft != null && onItsWay(draft),
  );
}

export function draftLine(draft: Draft): string {
  const result = resultOf(draft);

  switch (draft.step) {
    case 'countdown':
      return say.sendingIn(draft.seconds);
    case 'sending':
      return say.soFar(result.soFar, result.count);
    case 'sent':
      return say.reached(result.reached, result.count);
    case 'failed':
      return W.nothingWasSent;
    default:
      return say.notSentYet(TO_WORD[draft.to]);
  }
}

export function doneLine(m: Messages, key: GuestKey): string | null {
  const at = m.doneAt[key];

  return m.done.includes(key) && at != null ? say.doneBy(READER, at) : null;
}
