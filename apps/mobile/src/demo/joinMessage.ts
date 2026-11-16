import { visibleLength } from '@soirely/domain';

import { MESSAGE_MOST, messageCount } from '../steps/rules.ts';
import { SAMPLE } from './samples.ts';

export type JoinLanguage = 'en' | 'fr';
export type JoinMessageStart = 'empty' | 'long' | 'lines' | 'over';

export interface JoinCopy {
  title: string;
  label: string;
  tooLong: string;
  count: (message: string) => string;
  whatTheySee: string;
  ask: string;
  asking: string;
}

/** English is the board's; French is the longest of the four, so the SE is checked in it. The developer takes the product's from the locales. */
export const JOIN_COPY: Record<JoinLanguage, JoinCopy> = {
  en: {
    title: `Ask to join ${SAMPLE.organisation}`,
    label: 'Message · optional',
    tooLong: `Keep your message to ${MESSAGE_MOST} characters or fewer.`,
    count: messageCount,
    whatTheySee: `${SAMPLE.organisation} sees your name, your email address and your message.`,
    ask: 'Ask to join',
    asking: 'Asking…',
  },
  fr: {
    title: `Demander à rejoindre ${SAMPLE.organisation}`,
    label: 'Message · facultatif',
    tooLong: `Raccourcissez votre message à ${MESSAGE_MOST} caractères maximum.`,
    count: (message) => `${visibleLength(message)} sur ${MESSAGE_MOST} caractères.`,
    whatTheySee: `${SAMPLE.organisation} verra votre nom, votre adresse e-mail et votre message.`,
    ask: 'Demander l’accès',
    asking: 'Envoi de la demande…',
  },
};

export function joinLanguage(param: string | undefined): JoinLanguage {
  return param === 'fr' ? 'fr' : 'en';
}

export function joinStart(param: string | undefined): JoinMessageStart {
  return param === 'long' || param === 'lines' || param === 'over' ? param : 'empty';
}

/** Typing is never stopped at the most, as on the real screen: a paste cut off there loses words nobody chose to drop. */
export function messageTooLong(message: string): boolean {
  return visibleLength(message) > MESSAGE_MOST;
}

/** What a state starts with: QA's two checks, 500 letters in one run and 40 one-word lines, and one letter past the most. */
export function startingMessage(start: JoinMessageStart): string {
  switch (start) {
    case 'long':
      return SAMPLE.joinMessageLong;
    case 'lines':
      return Array.from({ length: 40 }, (_, line) => `Line${line + 1}`).join('\n');
    case 'over':
      return 'a'.repeat(MESSAGE_MOST + 1);
    case 'empty':
      return '';
  }
}
