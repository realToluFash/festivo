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

export type CodeBox = 'email' | 'text';

export const CODE_SHORT = 'The code is 6 digits.';

/** Each box's words on Enter both codes, as the app has them (`lostTwoFactor.*`); the phone's follow WhatsApp until Text it to me instead. */
export function boxWords(
  box: CodeBox,
  texted: boolean,
  to: string,
): { label: string; sent: string; blank: string; wrong: string } {
  if (box === 'email') {
    return {
      label: 'Code from the email',
      sent: `Sent to ${to}`,
      blank: 'Enter the 6-digit code from the email.',
      wrong: 'That code does not match. Check the newest email from Soirely and try again.',
    };
  }

  return texted
    ? {
        label: 'Code from the text',
        sent: `Texted to ${to}: the same code as on WhatsApp`,
        blank: 'Enter the 6-digit code from the text.',
        wrong: 'That code does not match. Check the newest text from Soirely and try again.',
      }
    : {
        label: 'Code from WhatsApp',
        sent: `Sent to your WhatsApp on ${to}`,
        blank: 'Enter the 6-digit code from WhatsApp.',
        wrong:
          'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
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

export interface Tries {
  wrongs: number;
  spent: Spent | null;
}

export function wrongAsk(tries: Tries): Tries {
  const wrongs = tries.wrongs + 1;

  return { wrongs, spent: spentAfter(wrongs) };
}

/** A new code, from the resend link or from a spent notice, starts the count again. */
export function newCode(): Tries {
  return { wrongs: 0, spent: null };
}

export type Answer = 'approved' | 'turnedDown' | 'ended' | 'replaced';

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

/** Not reached: the sheet stays open and says so. Reached: cancelled, unless an answer came first, which the screen then shows. */
export function cancelSettled(
  sheet: CancelSheet,
  reached: boolean,
  answered: Answer | null = null,
): CancelSheet | Answer | 'cancelled' {
  if (!reached) return { ...sheet, sending: false, notCancelled: true };

  return answered ?? 'cancelled';
}

/** Keep waiting, a tap outside or the escape close it, except while the cancel is on its way. */
export function keepWaiting(sheet: CancelSheet): CancelSheet {
  return sheet.sending ? sheet : CLOSED;
}
