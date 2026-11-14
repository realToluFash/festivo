import { CANCELLED_AT, SCHEDULED_BODY, SCHEDULE_AT } from './MessagesSample.ts';

/** sc-3963's refused save, in the web demo's words (AC editing bullet; l10n #28795; pm 7 Nov). */
export const SW = {
  notSavedSent: 'Not saved. This message has already been sent.',
  notSavedCancelled: 'Not saved. This message has been cancelled.',
  notSavedTooLate: 'Not saved. This message was too late to send.',
  textStillHere: 'Your text is still here. Reload to see the message as it is now.',
  reload: 'Reload',
  tooLateWhy: 'The event was not resumed or restored within 48 hours of this message’s time.',
  editingPaused: 'Editing.',
  finishedWhy: 'The event finished before this message was due.',
} as const;

/** How late a held message may go: the API's figure, 48 in the sample. */
export const TOO_LATE_HOURS = 48;

/** sc-3963's paused line: one string for both sides of the message's time (l10n #28804), a plural family on the API's hours. */
export function pausedWaits(hours = TOO_LATE_HOURS): string {
  return `This message is waiting while the event is paused. If the event is live again by this message’s time, it goes then. If not, it goes soon after the event is live again, unless that is more than ${hours} ${hours === 1 ? 'hour' : 'hours'} late.`;
}

export const saySaved = {
  notSavedChanged: (name: string) => `Not saved. ${name} changed this message.`,
};

export type Refusal = 'conflict' | 'sent' | 'cancelled' | 'tooLate';

/** Who changed or cancelled it meanwhile: the refused save's own answer names them, a sample value here. */
export const CHANGED_BY = 'Bisi Okafor';

const REFUSALS: Partial<Record<string, Refusal>> = {
  editConflict: 'conflict',
  editSent: 'sent',
  editCancelled: 'cancelled',
  editTooLate: 'tooLate',
};

export function refusalOf(state: string | null): Refusal | null {
  return (state == null ? undefined : REFUSALS[state]) ?? null;
}

export function refusalLine(refusal: Refusal): string {
  switch (refusal) {
    case 'conflict':
      return saySaved.notSavedChanged(CHANGED_BY);
    case 'sent':
      return SW.notSavedSent;
    case 'cancelled':
      return SW.notSavedCancelled;
    default:
      return SW.notSavedTooLate;
  }
}

function doorsAt(body: string, time: string): string {
  return body.replace(/The doors open at \d\d:\d\d\./u, `The doors open at ${time}.`);
}

/** What was typed before Save was refused: the scheduled words, their last sentence changed. */
export const TYPED_EDIT = doorsAt(SCHEDULED_BODY, '17:15');

/** The message as it is now, which Reload shows: a colleague's version, sent, cancelled, or too late. */
export function reloaded(refusal: Refusal): {
  step: 'scheduled' | 'sent' | 'cancelled';
  body: string;
  outcome?: 'sent' | 'tooLate';
  time?: string;
  cancelledAt?: string;
  cancelledBy?: string;
} {
  switch (refusal) {
    case 'conflict':
      return { step: 'scheduled', body: doorsAt(SCHEDULED_BODY, '17:00') };
    case 'sent':
      return { step: 'sent', body: SCHEDULED_BODY, outcome: 'sent', time: SCHEDULE_AT.time };
    case 'cancelled':
      return {
        step: 'cancelled',
        body: SCHEDULED_BODY,
        time: CANCELLED_AT,
        cancelledAt: CANCELLED_AT,
        cancelledBy: CHANGED_BY,
      };
    default:
      return { step: 'scheduled', body: SCHEDULED_BODY, outcome: 'tooLate' };
  }
}
