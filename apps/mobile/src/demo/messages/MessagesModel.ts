import { instantOf } from '../events/EventsModel.ts';
import { READER_ZONE } from '../events/EventsSample.ts';
import {
  ADDED,
  ANSWERS,
  BALANCE,
  BODY,
  CANCELLED_AT,
  CANT_TELL,
  DAYS,
  EVENT_ENDS,
  FIXED_ADDRESS,
  FOLLOW_UP,
  GUESTS,
  type GroupKey,
  type GuestKey,
  LOW_BALANCE,
  type ManyKey,
  NOTICE_CREDITS,
  NOW,
  OTHER_CHANNELS,
  PLACE,
  type PersonKey,
  READER,
  READER_NOW,
  SCHEDULED,
  SCHEDULED_BODY,
  SCHEDULE_AT,
  SENT_AGAIN_AT,
  SMS_ONLY,
  SUBJECT,
  TELL,
  TO_FIGURES,
  TO_WORD,
  type ToGroup,
  formatCount,
} from './MessagesSample.ts';
import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { EDGE } from './TokenText.ts';

/** Every state of Messaging B, each a `?state=` in both demos (spec §7 and §7b), in the spec's order. */
export const MESSAGES_STATES = [
  'first',
  'loading',
  'inUse',
  'conversation',
  'replyArrived',
  'answered',
  'channelReply',
  'noticeCost',
  'noticeWaits',
  'noticeNotSent',
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
  'invitedReached',
  'sentReached',
  'notMatched',
  'matchPicker',
  'matched',
  'later',
  'scheduledEdit',
  'sendNow',
  'cancelAsk',
  'scheduledCancelled',
  'fixed',
  'sentAgain',
  'checkAll',
  'checkNotReplied',
  'checkChannels',
  'noSubject',
  'followUp',
  'tellPlace',
  'added',
  'addedPhone',
  'notNow',
  'told',
  'filterMenu',
  'filtered',
  'resendInvited',
  'resendSent',
] as const;

export type MessagesState = (typeof MESSAGES_STATES)[number];

export function messagesStateOf(value: string | undefined): MessagesState | null {
  return MESSAGES_STATES.find((state) => state === value) ?? null;
}

export type ReachedOf = 'parking' | 'invite' | 'draft';

export type FixKind = 'fixEmail' | 'addEmail' | 'addPhone';

export type ReachFilter = 'everyone' | 'notReached' | 'told' | GroupKey;

/** A person's mark on one message: sent again, Not now taken or told in person belong to that message, not to the guest. */
export function personAt(of: ReachedOf, key: PersonKey): string {
  return `${of}.${key}`;
}

export type Open =
  | { kind: 'guest'; key: GuestKey }
  | { kind: 'many'; key: ManyKey }
  | { kind: 'draft' }
  | { kind: 'reached'; of: ReachedOf }
  | null;

export type Step =
  | 'write'
  | 'preview'
  | 'check'
  | 'countdown'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'scheduled'
  | 'cancelled';

export const COUNTDOWN_SECONDS = 10;
export const SENDING_SECONDS = 3;

export interface Moment {
  date: string;
  time: string;
}

export interface Draft {
  to: ToGroup;
  channels: Record<ChannelKey, boolean>;
  subject: string;
  body: string;
  step: Step;
  seconds: number;
  wait: number | null;
  cancelled: boolean;
  at: Moment | null;
  was: { subject: string; body: string } | null;
  asking: boolean;
  cancelledAt: string | null;
  time: string;
  seen: number;
  soFar: number | null;
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
  address?: boolean;
}

/** How Soirely's notice of an answer went: told, held for credits (sc-3932), or held 48 hours and not sent (sc-3950). */
export type Notice = 'told' | 'held' | 'tooLate';

export interface Answer {
  text: string;
  time: string;
  seen: string | null;
  by: ChannelKey;
  notice: Notice;
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
  balance: number;
  tellBy: Partial<Record<GuestKey, ChannelKey>>;
  heldTooLong: boolean;
  matched: string | null;
  matching: boolean;
  when: boolean;
  untold: boolean;
  telling: boolean;
  change: TellChange;
  fixing: boolean;
  fixed: Partial<Record<PersonKey, string>>;
  how: Partial<Record<PersonKey, FixKind>>;
  again: Partial<Record<string, string>>;
  waiting: readonly string[];
  toldIn: Partial<Record<string, string>>;
  said: string | null;
  filter: ReachFilter | null;
  filtering: boolean;
  resending: boolean;
  bell: boolean;
  told: string | null;
}

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
    at: null,
    was: null,
    asking: false,
    cancelledAt: null,
    time: NOW,
    seen: 3,
    soFar: null,
  };
}

export function sampleDraft(step: Step = 'write'): Draft {
  return { ...blankDraft(), to: 'coming', subject: SUBJECT, body: BODY, step };
}

const SCHED: Kept = {
  id: 'sched',
  base: null,
  earlier: [],
  draft: {
    ...blankDraft(),
    to: 'coming',
    subject: SCHEDULED,
    body: SCHEDULED_BODY,
    step: 'scheduled',
    at: SCHEDULE_AT,
    time: '',
  },
};

const NEW_THREAD: Thread = { id: 'new-1', base: null, earlier: [] };

const BASE: Messages = {
  phase: 'list',
  open: null,
  thread: null,
  draft: null,
  kept: [SCHED],
  made: 1,
  picking: false,
  arrived: false,
  done: [],
  doneAt: {},
  answers: {},
  typed: {},
  balance: BALANCE,
  tellBy: {},
  heldTooLong: false,
  matched: null,
  matching: false,
  when: false,
  untold: false,
  telling: false,
  change: { lines: [say.startMoved(TELL.now, TELL.was)], what: [W.newStartTime] },
  fixing: false,
  fixed: {},
  how: {},
  again: {},
  waiting: [],
  toldIn: {},
  said: null,
  filter: null,
  filtering: false,
  resending: false,
  bell: false,
  told: null,
};

const DRAFTED: Partial<Record<MessagesState, Draft>> = {
  to: sampleDraft('write'),
  write: sampleDraft('write'),
  preview: sampleDraft('preview'),
  check: sampleDraft('check'),
  countdown: sampleDraft('countdown'),
  cancelled: { ...sampleDraft('write'), cancelled: true },
  sending: sampleDraft('sending'),
  sent: sampleDraft('sent'),
  failed: sampleDraft('failed'),
  later: sampleDraft('check'),
  checkAll: { ...sampleDraft('check'), to: 'all' },
  checkNotReplied: { ...sampleDraft('check'), to: 'notReplied' },
  checkChannels: { ...sampleDraft('check'), channels: { email: true, sms: false, wa: false } },
  noSubject: { ...sampleDraft('sent'), subject: '', seen: 12 },
};

const SCHEDULED_AS: Partial<Record<MessagesState, Partial<Draft>>> = {
  scheduled: {},
  scheduledEdit: { step: 'write', was: { subject: SCHEDULED, body: SCHEDULED_BODY } },
  sendNow: { step: 'check' },
  cancelAsk: { asking: true },
  scheduledCancelled: { step: 'cancelled', cancelledAt: CANCELLED_AT, time: CANCELLED_AT },
};

function scheduledStart(change: Partial<Draft>): Messages {
  const { draft, ...thread } = SCHED;

  return { ...BASE, kept: [], thread, draft: { ...draft, ...change }, open: { kind: 'draft' } };
}

/** Where a `?state=` opens; `wide` is the iPad, where a conversation stays open beside the list. */
export function startOf(state: MessagesState | null, wide: boolean): Messages {
  const drafted = state == null ? undefined : DRAFTED[state];
  if (drafted != null)
    return {
      ...BASE,
      open: { kind: 'draft' },
      picking: state === 'to',
      when: state === 'later',
      thread: NEW_THREAD,
      draft: drafted,
      told: state === 'cancelled' && !wide ? W.cancelled : null,
    };
  const scheduled = state == null ? undefined : SCHEDULED_AS[state];
  if (scheduled != null) return scheduledStart(scheduled);
  const ines: Open = { kind: 'guest', key: 'ines' };
  const unknown: Open = { kind: 'guest', key: 'unknown' };
  const lucia: Open = { kind: 'guest', key: 'lucia' };
  const parking: Open = { kind: 'reached', of: 'parking' };

  switch (state) {
    case 'first':
      return { ...BASE, phase: 'first', kept: [] };
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
        answers: {
          ines: {
            text: ANSWERS.ines ?? '',
            time: '09:20',
            seen: '09:31',
            by: 'email',
            notice: 'told',
          },
        },
      };
    case 'channelReply':
      return {
        ...BASE,
        open: { kind: 'guest', key: 'kwame' },
        typed: { kwame: ANSWERS.kwame ?? '' },
      };
    case 'noticeCost':
      return { ...BASE, open: lucia, typed: { lucia: ANSWERS.lucia ?? '' } };
    case 'noticeWaits':
      return { ...BASE, open: lucia, typed: { lucia: ANSWERS.lucia ?? '' }, balance: LOW_BALANCE };
    case 'noticeNotSent':
      return { ...BASE, open: lucia, balance: LOW_BALANCE, heldTooLong: true };
    case 'reached':
      return { ...BASE, open: parking };
    case 'fix':
      return { ...BASE, open: parking, fixing: true };
    case 'fixed':
      return { ...BASE, open: parking, fixed: { tomas: FIXED_ADDRESS } };
    case 'sentAgain':
      return {
        ...BASE,
        open: parking,
        fixed: { tomas: FIXED_ADDRESS },
        again: { 'parking.tomas': SENT_AGAIN_AT },
        said: 'parking.tomas',
      };
    case 'added':
      return {
        ...BASE,
        open: parking,
        fixed: { joaquin: ADDED.email },
        how: { joaquin: 'addEmail' },
        filter: 'none',
      };
    case 'addedPhone':
      return {
        ...BASE,
        open: parking,
        fixed: { lars: ADDED.phone },
        how: { lars: 'addPhone' },
        filter: 'optedOut',
      };
    case 'notNow':
      return {
        ...BASE,
        open: parking,
        fixed: { tomas: FIXED_ADDRESS },
        waiting: ['parking.tomas'],
      };
    case 'told':
      return { ...BASE, open: parking, toldIn: { 'parking.amaka': SENT_AGAIN_AT }, filter: 'told' };
    case 'filterMenu':
      return { ...BASE, open: parking, filtering: true };
    case 'filtered':
      return { ...BASE, open: parking, filter: 'bounced' };
    case 'resendInvited':
      return { ...BASE, open: { kind: 'many', key: 'invite' }, resending: true };
    case 'resendSent':
      return {
        ...BASE,
        thread: NEW_THREAD,
        draft: sampleDraft('sending'),
        open: { kind: 'draft' },
        resending: true,
      };
    case 'invitedReached':
      return { ...BASE, open: { kind: 'reached', of: 'invite' } };
    case 'sentReached':
      return {
        ...BASE,
        thread: NEW_THREAD,
        draft: sampleDraft('sending'),
        open: { kind: 'reached', of: 'draft' },
      };
    case 'resend':
      return { ...BASE, open: { kind: 'many', key: 'parking' }, resending: true };
    case 'notMatched':
      return { ...BASE, open: unknown };
    case 'matchPicker':
      return { ...BASE, open: unknown, matching: true };
    case 'matched':
      return { ...BASE, open: unknown, matched: 'Camille Dubois' };
    case 'followUp':
      return {
        ...BASE,
        open: { kind: 'draft' },
        thread: { ...NEW_THREAD, earlier: [{ ...sampleDraft('sent'), seen: 41 }] },
        draft: {
          ...sampleDraft('sending'),
          subject: '',
          body: FOLLOW_UP,
          soFar: 20,
          time: '10:05',
        },
      };
    case 'tell':
      return { ...BASE, telling: true };
    case 'tellPlace':
      return {
        ...BASE,
        telling: true,
        change: {
          lines: [say.venueMoved(PLACE.name, 'The Landmark')],
          what: [W.newVenue],
          address: true,
        },
      };
    case 'untold':
      return { ...BASE, untold: true, open: wide ? ines : null };
    case 'invited':
      return { ...BASE, open: { kind: 'many', key: 'invite' } };
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
  | { type: 'when'; open: boolean }
  | { type: 'schedule'; at: Moment }
  | { type: 'editScheduled' }
  | { type: 'saveScheduled' }
  | { type: 'sendNow' }
  | { type: 'keepScheduled' }
  | { type: 'askCancel'; open: boolean }
  | { type: 'cancelScheduled' }
  | { type: 'matching'; open: boolean }
  | { type: 'match'; name: string }
  | { type: 'answer'; key: GuestKey; text: string }
  | { type: 'tellBy'; key: GuestKey; channel: ChannelKey }
  | { type: 'markDone'; key: GuestKey }
  | { type: 'markWaiting'; key: GuestKey }
  | { type: 'telling'; open: boolean }
  | { type: 'offerTell'; change: TellChange }
  | { type: 'notNow' }
  | { type: 'tellSent' }
  | { type: 'dismissUntold' }
  | { type: 'fixing'; open: boolean }
  | { type: 'fixed'; key: PersonKey; address: string; how?: FixKind }
  | { type: 'notNowFor'; key: PersonKey }
  | { type: 'markTold'; key: PersonKey }
  | { type: 'undoTold'; key: PersonKey }
  | { type: 'filter'; filter: ReachFilter }
  | { type: 'filtering'; open: boolean }
  | { type: 'sendAgain'; key: PersonKey }
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

export function isScheduled(draft: Draft): boolean {
  return draft.at != null && draft.step !== 'cancelled';
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

function baseOf(open: Open): ManyKey | null {
  if (open?.kind === 'many') return open.key;
  if (open?.kind === 'reached' && open.of !== 'draft') return open.of;

  return null;
}

/** The message whose Who it reached is open, or whose conversation is: the draft's for a new message. */
export function reachedOf(m: Pick<Messages, 'open'>): ReachedOf {
  const open = m.open;
  if (open?.kind === 'reached') return open.of;
  if (open?.kind === 'draft') return 'draft';
  if (open?.kind === 'many' && open.key === 'invite') return 'invite';

  return 'parking';
}

function opened(m: Messages, open: Open): Messages {
  const base = baseOf(open);
  const another = open?.kind === 'reached' && reachedOf(m) !== open.of;
  const next = {
    ...m,
    open,
    picking: false,
    ...(another ? { filter: null, filtering: false } : {}),
  };

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

function back(open: Open): Open {
  if (open?.kind !== 'reached') return null;
  if (open.of === 'draft') return { kind: 'draft' };

  return { kind: 'many', key: open.of };
}

export function reduce(m: Messages, action: Action): Messages {
  switch (action.type) {
    case 'open':
      return opened(m, action.open);
    case 'back':
      return opened(m, back(m.open));
    case 'newMessage': {
      const draft = m.draft;
      const keep =
        m.thread?.base == null &&
        draft != null &&
        draft.at == null &&
        (writing(draft) || onItsWay(draft));
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
          ? {
              ...draft,
              step: 'countdown',
              seconds: COUNTDOWN_SECONDS,
              cancelled: false,
              at: null,
              time: NOW,
            }
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
    case 'when':
      return { ...m, when: action.open };
    case 'schedule':
      return {
        ...withDraft(m, (draft) => ({
          ...draft,
          at: action.at,
          step: draft.step === 'check' ? 'scheduled' : draft.step,
        })),
        when: false,
      };
    case 'editScheduled':
      return withDraft(m, (draft) =>
        draft.step === 'scheduled'
          ? { ...draft, step: 'write', was: { subject: draft.subject, body: draft.body } }
          : draft,
      );
    case 'saveScheduled':
      return withDraft(m, (draft) =>
        draft.was != null && canSend(draft) ? { ...draft, step: 'scheduled', was: null } : draft,
      );
    case 'sendNow':
      return stepped(m, ['scheduled'], 'check');
    case 'keepScheduled':
      return withDraft(m, (draft) =>
        draft.step === 'check' && draft.at != null ? { ...draft, step: 'scheduled' } : draft,
      );
    case 'askCancel':
      return withDraft(m, (draft) => ({ ...draft, asking: action.open }));
    case 'cancelScheduled':
      return withDraft(m, (draft) => ({
        ...draft,
        step: 'cancelled',
        asking: false,
        cancelledAt: CANCELLED_AT,
        time: CANCELLED_AT,
      }));
    case 'matching':
      return { ...m, matching: action.open };
    case 'match':
      return { ...m, matched: action.name, matching: false };
    case 'answer': {
      const by = tellingBy(m, action.key);
      const cost = noticeCostOf(m, action.key);

      return {
        ...m,
        answers: {
          ...m.answers,
          [action.key]: {
            text: action.text,
            time: NOW,
            seen: null,
            by,
            notice: cost?.waits === true ? 'held' : 'told',
          },
        },
        typed: { ...m.typed, [action.key]: '' },
        balance: cost == null || cost.waits ? m.balance : cost.after,
      };
    }
    case 'tellBy':
      return { ...m, tellBy: { ...m.tellBy, [action.key]: action.channel } };
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
      return {
        ...m,
        fixing: false,
        fixed: { ...m.fixed, [action.key]: action.address },
        how: { ...m.how, [action.key]: action.how ?? 'fixEmail' },
        waiting: m.waiting.filter((at) => at !== personAt(reachedOf(m), action.key)),
        told: W.saved,
      };
    case 'sendAgain': {
      const at = personAt(reachedOf(m), action.key);

      return {
        ...m,
        again: { ...m.again, [at]: SENT_AGAIN_AT },
        waiting: m.waiting.filter((one) => one !== at),
        said: at,
        filter: m.filter === 'everyone' ? m.filter : null,
      };
    }
    case 'notNowFor': {
      const at = personAt(reachedOf(m), action.key);

      return { ...m, waiting: [...m.waiting.filter((one) => one !== at), at] };
    }
    case 'markTold':
      return {
        ...m,
        toldIn: { ...m.toldIn, [personAt(reachedOf(m), action.key)]: SENT_AGAIN_AT },
      };
    case 'undoTold': {
      const { [personAt(reachedOf(m), action.key)]: _undone, ...rest } = m.toldIn;

      return { ...m, toldIn: rest };
    }
    case 'filter':
      return { ...m, filter: action.filter, filtering: false };
    case 'filtering':
      return { ...m, filtering: action.open };
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
export type RowId = RowKey | { kind: 'draft'; id: string };

export interface Own {
  id: string;
  thread: Thread;
  draft: Draft;
}

export function ownThreads(m: Messages): Own[] {
  const active =
    m.thread != null && m.thread.base == null && m.draft != null
      ? [{ id: m.thread.id, thread: m.thread, draft: m.draft }]
      : [];
  const kept = m.kept
    .filter((one) => one.base == null)
    .map(({ draft, ...thread }) => ({ id: thread.id, thread, draft }));

  return [...active, ...kept];
}

export interface Sections {
  top: readonly RowId[];
  needs: readonly RowId[];
  scheduled: readonly RowId[];
  done: readonly RowId[];
}

const guest = (key: GuestKey): RowId => ({ kind: 'guest', key });
const many = (key: ManyKey): RowId => ({ kind: 'many', key });
const own = (one: Own): RowId => ({ kind: 'draft', id: one.id });

/** Own messages at the top, then Needs you, Scheduled and Done; a guest marked done moves to the top of Done. */
export function sectionsOf(m: Messages): Sections {
  const waiting: GuestKey[] = m.arrived ? ['lucia', 'ines', 'kwame'] : ['ines', 'lucia', 'kwame'];
  const mine = ownThreads(m);

  return {
    top: mine.filter((one) => !isScheduled(one.draft) && one.draft.step !== 'cancelled').map(own),
    needs: [
      ...waiting.filter((key) => !m.done.includes(key)).map(guest),
      ...(m.done.includes('unknown') ? [] : [guest('unknown')]),
      many('parking'),
    ],
    scheduled: mine.filter((one) => isScheduled(one.draft)).map(own),
    done: [
      ...mine.filter((one) => one.draft.step === 'cancelled').map(own),
      ...m.done.filter((key) => key !== 'marta').map(guest),
      guest('marta'),
      many('invite'),
    ],
  };
}

export function badgeOf(
  m: Messages,
): { waiting: number; notMatched: number; total: number } | null {
  if (m.phase !== 'list') return null;
  const guests: GuestKey[] =
    m.matched == null ? ['ines', 'lucia', 'kwame'] : ['ines', 'lucia', 'kwame', 'unknown'];
  const waiting = guests.filter((key) => !m.done.includes(key)).length + (m.arrived ? 1 : 0);
  const notMatched = m.matched == null && !m.done.includes('unknown') ? 1 : 0;

  return { waiting, notMatched, total: waiting + notMatched };
}

export interface Check {
  count: number;
  told: readonly { key: ChannelKey; count: number }[];
  cantTell: number;
  smsOff: number;
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
  const smsOff = draft.channels.sms ? 0 : SMS_ONLY[draft.to].length;
  const names = (smsOff > 0 ? SMS_ONLY[draft.to] : CANT_TELL[draft.to]).slice(0, 2);
  const cantTell = figures.cantTell + smsOff;

  return {
    count: figures.count,
    told: ticked.map((key) => ({ key, count: figures[key] })),
    cantTell,
    smsOff,
    names,
    seeAll: cantTell > names.length,
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
  const check = checkOf(draft);

  return {
    count: check.count,
    reached: check.count - check.cantTell,
    soFar: draft.soFar ?? Math.round(check.count * 0.4),
    seen: draft.seen,
  };
}

/** The countdown is said only at 10, 5 and 0, never every second (WCAG 2.2 SC 4.1.3); at 0 it says the message is queued. */
export function spokenAt(seconds: number, count: number): string | null {
  if (seconds === COUNTDOWN_SECONDS || seconds === 5) return say.sendingIn(seconds);
  if (seconds === 0) return say.queued(count);

  return null;
}

/** A message's name: its Subject, or with none its first line, tokens by their names; the screen shortens it to fit (pm). */
export function messageName(draft: Draft): string {
  const first = (draft.body.trim().split(/\r?\n/u)[0] ?? '').trim();

  return draft.subject.trim() || first.replaceAll(EDGE, '');
}

export function draftTitle(draft: Draft, thread: Thread | null = null): string {
  const first = thread?.earlier[0];
  if (first != null) return messageName(first);

  return writing(draft) && draft.at == null ? W.newMessage : messageName(draft);
}

function wallDate(date: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function dayWords(date: string, locale = 'en-US'): string {
  return wallDate(date, locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A row's when: the time today, the weekday within the week, else the month and day, in the reader's locale. */
export function rowDay(date: string, time: string, locale = 'en-US'): string {
  if (date === DAYS.today && time !== '') return time;
  const days =
    (Date.parse(`${DAYS.today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;

  return days < 7
    ? wallDate(date, locale, { weekday: 'short' })
    : wallDate(date, locale, { month: 'short', day: 'numeric' });
}

export function justNow(locale = 'en-US'): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second');
}

export function channelsWords(keys: readonly ChannelKey[], locale = 'en-US'): string {
  return new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    keys.map((key) => CHANNEL_WORD[key]),
  );
}

export function draftLine(draft: Draft, thread: Thread | null = null, locale = 'en-US'): string {
  const result = resultOf(draft);
  if (draft.step === 'cancelled')
    return say.cancelledRow(READER, draft.cancelledAt ?? CANCELLED_AT);
  if (draft.at != null)
    return `${say.toGroup(TO_WORD[draft.to])} · ${say.dayTime(dayWords(draft.at.date, locale), draft.at.time)}`;
  const line = (() => {
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
  })();

  return (thread?.earlier.length ?? 0) > 0 ? say.followUpRow(line) : line;
}

export function anyOnItsWay(m: Messages): boolean {
  return [m.draft, ...m.kept.map((kept) => kept.draft)].some(
    (draft) => draft != null && onItsWay(draft),
  );
}

const FIVE_MINUTES = 5 * 60 * 1000;

export function laterRefused(at: Moment): boolean {
  const when = Date.parse(instantOf(at.date, at.time, READER_ZONE));

  return when < Date.parse(READER_NOW) + FIVE_MINUTES || when >= Date.parse(EVENT_ENDS.at);
}

export interface NoticeCost {
  channel: 'sms' | 'wa';
  credits: number;
  after: number;
  waits: boolean;
}

/** Before Send (sc-3976, sc-3931): what the notice costs and the credits after it; email costs nothing and shows nothing. */
export function noticeCost(
  channel: ChannelKey,
  credits: number,
  balance: number,
): NoticeCost | null {
  if (channel === 'email' || credits <= 0) return null;

  return { channel, credits, after: balance - credits, waits: credits > balance };
}

/** The channel Soirely tells this guest by: their latest message's, unless the host picked another. */
export function tellingBy(m: Messages, key: GuestKey): ChannelKey {
  return m.tellBy[key] ?? GUESTS[key].channel;
}

export function noticeCostOf(m: Messages, key: GuestKey): NoticeCost | null {
  const channel = tellingBy(m, key);

  return noticeCost(channel, NOTICE_CREDITS[key]?.[channel] ?? 0, m.balance);
}

/** When the notice would wait: the guest's other channels that can tell them now, email first, a paid one only if covered. */
export function tellNowBy(m: Messages, key: GuestKey): readonly ChannelKey[] {
  const by = tellingBy(m, key);

  return (OTHER_CHANNELS[key] ?? []).filter(
    (channel) =>
      channel !== by &&
      noticeCost(channel, NOTICE_CREDITS[key]?.[channel] ?? 0, m.balance)?.waits !== true,
  );
}
