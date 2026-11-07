/** Lost authenticator's words and the cancel sheet's moves, kept apart from React Native so they can be tested. */

/** Wrong asks before the codes no longer work. */
export const TRIES = 5;

export type Spent = 'expired' | 'exhausted';

/** An account with no verified mobile is sent one code, so every line counts one (sc-30737). */
export function codeWords(emailOnly: boolean) {
  return emailOnly
    ? {
        step: 'You enter the code here.',
        send: 'Send the code',
        sending: 'Sending the code…',
        resend: 'Send a new code',
      }
    : {
        step: 'You enter the codes here.',
        send: 'Send the codes',
        sending: 'Sending the codes…',
        resend: 'Send new codes',
      };
}

export function spentWords(spent: Spent, emailOnly: boolean): { title: string; body: string } {
  if (spent === 'exhausted') {
    return {
      title: 'Too many wrong tries',
      body: emailOnly
        ? 'That code no longer works. Send a new one to carry on.'
        : 'Those codes no longer work. Send new ones to carry on.',
    };
  }

  return emailOnly
    ? {
        title: 'That code has expired',
        body: 'Codes only work for a while. Send a new one and use the code in the newest email.',
      }
    : {
        title: 'Those codes have expired',
        body: 'Codes only work for a while. Send new ones and use the codes in the newest email and text.',
      };
}

export function spentAfter(wrongs: number): Spent | null {
  return wrongs >= TRIES ? 'exhausted' : null;
}

export const NOT_CANCELLED = 'Not cancelled. Your request is still waiting. Try again.';

export interface CancelSheet {
  open: boolean;
  sending: boolean;
  notCancelled: boolean;
}

export const CLOSED: CancelSheet = { open: false, sending: false, notCancelled: false };

export function askToCancel(): CancelSheet {
  return { open: true, sending: false, notCancelled: false };
}

/** Pressing Cancel the request hides the last try's line while this one is on its way. */
export function pressCancel(sheet: CancelSheet): CancelSheet {
  return sheet.sending ? sheet : { ...sheet, sending: true, notCancelled: false };
}

/** Soirely cancels it, or could not be reached: the sheet stays open and says so. */
export function cancelSettled(sheet: CancelSheet, reached: boolean): CancelSheet | 'cancelled' {
  return reached ? 'cancelled' : { ...sheet, sending: false, notCancelled: true };
}

/** Keep waiting, a tap outside or the escape close it, except while the cancel is on its way. */
export function keepWaiting(sheet: CancelSheet): CancelSheet {
  return sheet.sending ? sheet : CLOSED;
}
