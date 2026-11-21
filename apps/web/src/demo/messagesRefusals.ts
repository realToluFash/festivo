import { MW } from './messagesWords.ts';
import type { Audience } from './messagesTo.ts';

export const SUBJECT_MOST = 150;
export const MESSAGE_MOST = 10_000;

/** The composer's fields in the form's order: focus goes to the first that fails (sc-3942, Decided 13 Nov). */
export const FIELDS = ['who', 'subject', 'body'] as const;

export type Field = (typeof FIELDS)[number];
export type Refusals = Partial<Record<Field, string>>;

export const REFUSAL_GROUP = 'The composer refuses a send (sc-3942)';

export const REFUSAL_STATES = [
  { key: 'blankMessage', name: 'A blank Message, Send pressed' },
  { key: 'longSubject', name: 'A subject over 150' },
  { key: 'longMessage', name: 'A message over 10,000' },
  { key: 'chooseNone', name: 'Choose guests, nobody chosen' },
  { key: 'allRefused', name: 'Every field refused at once' },
] as const;

export type RefusalState = (typeof REFUSAL_STATES)[number]['key'];

export function isRefusalState(state: string | null): state is RefusalState {
  return REFUSAL_STATES.some((one) => one.key === state);
}

export const CHOSE_NOBODY: Audience = { kind: 'who', conditions: [], pick: 'chosen' };

export function choseNobody(to: Audience): boolean {
  return to.kind === 'who' && to.pick === 'chosen' && to.conditions.length === 0;
}

/** Counted as the API counts it: characters, not UTF-16 units, with the ends trimmed. */
export function lengthOf(text: string): number {
  return [...text.trim()].length;
}

export interface Fields {
  to: Audience;
  subject: string;
  body: string;
}

export function refusalsOf(
  { to, subject, body }: Fields,
  filled: (words: string, slots: { count: number }) => string,
): Refusals {
  const said: Refusals = {};

  if (choseNobody(to)) said.who = MW.chooseOne;
  if (lengthOf(subject) > SUBJECT_MOST)
    said.subject = filled(MW.subjectTooLong, { count: SUBJECT_MOST });
  if (body.trim() === '') said.body = MW.enterMessage;
  else if (lengthOf(body) > MESSAGE_MOST)
    said.body = filled(MW.messageTooLong, { count: MESSAGE_MOST });

  return said;
}

export function firstRefused(said: Refusals): Field | null {
  return FIELDS.find((field) => said[field] != null) ?? null;
}

/** Where focus goes for a refused field: the To chip stands for Who gets it. */
export function focusOf(field: Field): 'to-chip' | 'subject' | 'body' {
  return field === 'who' ? 'to-chip' : field;
}

const PROGRAMME_LINE =
  'Thursday at 18:00 the ceremony begins at The Landmark; the doors open at 17:30, and the shuttle leaves Baker Street every fifteen minutes from 17:00.';

/** Over the Subject's 150: 168 characters, pasted from the hosts' own notes (the app's sample too). */
export const LONG_SUBJECT =
  'Parking, the dress code, the shuttle from Baker Street, the order of the day on Thursday and Saturday, and what to do if your train is late or the venue is hard to find';

/** Over the Message's 10,000: the programme pasted in 72 times, kept whole in the field. */
export const LONG_TAIL = Array.from({ length: 72 }, () => PROGRAMME_LINE).join('\n\n');

export interface RefusalSeed {
  chooseNone: boolean;
  subject: 'long' | null;
  body: 'blank' | 'long' | null;
}

export function refusalSeedOf(state: RefusalState): RefusalSeed {
  switch (state) {
    case 'blankMessage':
      return { chooseNone: false, subject: null, body: 'blank' };
    case 'longSubject':
      return { chooseNone: false, subject: 'long', body: null };
    case 'longMessage':
      return { chooseNone: false, subject: null, body: 'long' };
    case 'chooseNone':
      return { chooseNone: true, subject: null, body: null };
    case 'allRefused':
      return { chooseNone: true, subject: 'long', body: 'blank' };
  }
}
