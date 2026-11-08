import { demoWords } from './demoWords.ts';
import {
  type MessagesState,
  type Sched,
  type Segment,
  MW,
  READER,
  cancelledWords,
  toldWords,
} from './messages.ts';
import type { Bit } from './messagesContext.ts';

/** sc-3963's refused save (AC editing bullet; l10n #28795; 'Decided, 7 Nov (pm, on ux's #30726)'). */
export const SW = {
  notSavedChanged: 'Not saved. {{name}} changed this message.',
  notSavedSent: 'Not saved. This message has already been sent.',
  notSavedCancelled: 'Not saved. This message has been cancelled.',
  notSavedTooLate: 'Not saved. This message was too late to send.',
  textStillHere: 'Your text is still here. Reload to see the message as it is now.',
  reload: 'Reload',
  tooLateWhy_one:
    'The event was not resumed or restored within {{count, number}} hour of this message’s time.',
  tooLateWhy_other:
    'The event was not resumed or restored within {{count, number}} hours of this message’s time.',
};

const { filled, many } = demoWords(SW);

export type Refusal = 'conflict' | 'sent' | 'cancelled' | 'tooLate';

/** Who changed it meanwhile, in the sample: the AC's {name}, which no line on the boards gives yet. */
export const CHANGED_BY = 'Bisi Okafor';
export const TOO_LATE_HOURS = 48;

export function refusalOf(state: MessagesState | null): Refusal | null {
  switch (state) {
    case 'editConflict':
      return 'conflict';
    case 'editSent':
      return 'sent';
    case 'editCancelled':
      return 'cancelled';
    case 'editTooLate':
      return 'tooLate';
    default:
      return null;
  }
}

export function refusalLine(refusal: Refusal): string {
  switch (refusal) {
    case 'conflict':
      return filled(SW.notSavedChanged, { name: CHANGED_BY });
    case 'sent':
      return SW.notSavedSent;
    case 'cancelled':
      return SW.notSavedCancelled;
    default:
      return SW.notSavedTooLate;
  }
}

function doorsAt(body: readonly Segment[], time: string): Segment[] {
  return body.map((part) =>
    part.kind === 'text'
      ? {
          ...part,
          text: part.text.replace(/The doors open at \d\d:\d\d\./u, `The doors open at ${time}.`),
        }
      : part,
  );
}

/** What the person typed before Save was refused: the scheduled text, its last sentence changed. */
export function typedEdit(body: readonly Segment[]): Segment[] {
  return doorsAt(body, '17:15');
}

/** The message as it is now, which Reload shows. */
export function reloaded(refusal: Refusal, sched: Sched): Partial<Sched> {
  switch (refusal) {
    case 'conflict':
      return { body: doorsAt(sched.body, '17:00') };
    case 'sent':
      return { outcome: 'sent' };
    case 'cancelled':
      return { cancelledAt: '09:46', cancelledBy: CHANGED_BY };
    default:
      return { outcome: 'tooLate' };
  }
}

export function tooLateWhy(): string {
  return many('tooLateWhy', TOO_LATE_HOURS);
}

export function endedOf(sched: Sched): boolean {
  return sched.cancelledAt != null || sched.outcome != null;
}

export function statusWord(sched: Sched): string {
  if (sched.cancelledAt != null) return MW.cancelledTag;
  if (sched.outcome === 'sent') return toldWords(sched.ticks);
  if (sched.outcome === 'tooLate') return MW.notSentTooLate;

  return MW.scheduled;
}

export function endBits(sched: Sched): Bit[] {
  if (sched.outcome === 'sent')
    return [{ words: MW.onTheirPage }, { words: `${READER} · ${sched.time}` }];
  if (sched.outcome === 'tooLate') return [{ words: MW.notSentTooLate, mark: 'notsent' }];

  return [];
}

export function endLine(sched: Sched): string | null {
  if (sched.cancelledAt != null) return cancelledWords(sched);
  if (sched.outcome === 'tooLate') return tooLateWhy();

  return null;
}
