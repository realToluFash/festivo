import type { Encoding } from './Sms.ts';

/** sc-3946's English, settled by pm and l10n on 13 Nov. */
export const SMSW = {
  noReason: 'No reason given',
  demoTitle: 'Demo only: the time it is',
  happeningNow:
    'Thu, Nov 5 at 23:00 London time. The wedding is Happening now, so no text waits for morning.',
} as const;

export const FAILED_REASON: Record<string, (code: string) => string> = {
  '30003': (code) => `Phone off or out of signal (${code})`,
  '30005': (code) => `Number not in use (${code})`,
  '30006': (code) => `Number cannot receive texts (${code})`,
  '30007': (code) => `Blocked by their network (${code})`,
};

export type Quiet = 'sms' | 'both' | 'wa';

const WAITS: Record<Quiet, { one: string; other: string }> = {
  sms: {
    one: 'The text to {count} person waits until {time}, their time.',
    other: 'Texts to {count} people wait until {time}, their time.',
  },
  both: {
    one: 'Messages to {count} person by text or WhatsApp wait until {time}, their time.',
    other: 'Texts and WhatsApp messages to {count} people wait until {time}, their time.',
  },
  wa: {
    one: 'The WhatsApp message to {count} person waits until {time}, their time.',
    other: 'WhatsApp messages to {count} people wait until {time}, their time.',
  },
};

export const saySms = {
  noReason: (code: string) => `${SMSW.noReason} (${code})`,
  waits: (by: Quiet, count: number, time: string) =>
    WAITS[by][count === 1 ? 'one' : 'other']
      .replace('{count}', String(count))
      .replace('{time}', time),
  head: (parts: number, encoding: Encoding, chars: number) =>
    [
      'SMS',
      parts === 1 ? '1 part' : `${parts} parts`,
      encoding === 'gsm7' ? 'GSM-7' : 'Unicode',
      chars === 1 ? '1 character' : `${chars} characters`,
    ].join(' · '),
  firstText: (org: string) => `Their first text from ${org}, so it ends with how to stop texts.`,
};
