import { visibleLength } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { MESSAGE_MOST } from '../steps/rules.ts';
import {
  JOIN_COPY,
  joinLanguage,
  joinStart,
  messageTooLong,
  startingMessage,
} from './joinMessage.ts';

describe('Ask to join’s message in the demo', () => {
  it('is too long only past the most, counted as a person sees it', () => {
    expect(messageTooLong('a'.repeat(MESSAGE_MOST))).toBe(false);
    expect(messageTooLong('a'.repeat(MESSAGE_MOST + 1))).toBe(true);
    expect(messageTooLong('ẹ̀'.repeat(MESSAGE_MOST))).toBe(false);
  });

  it('starts each state with what QA types', () => {
    expect(startingMessage('empty')).toBe('');
    expect(visibleLength(startingMessage('long'))).toBeGreaterThan(300);
    expect(messageTooLong(startingMessage('long'))).toBe(false);
    expect(startingMessage('lines').split('\n')).toHaveLength(40);
    expect(visibleLength(startingMessage('over'))).toBe(MESSAGE_MOST + 1);
  });

  it('takes only the states and languages it draws', () => {
    expect(joinStart('over')).toBe('over');
    expect(joinStart('nonsense')).toBe('empty');
    expect(joinStart(undefined)).toBe('empty');
    expect(joinLanguage('fr')).toBe('fr');
    expect(joinLanguage('de')).toBe('en');
  });

  it('says the refusal and the count in both languages', () => {
    expect(JOIN_COPY.en.tooLong).toBe('Keep your message to 500 characters or fewer.');
    expect(JOIN_COPY.fr.tooLong).toBe('Raccourcissez votre message à 500 caractères maximum.');
    expect(JOIN_COPY.en.count(500)).toBe('500 of 500 characters.');
    expect(JOIN_COPY.fr.count(501)).toBe('501 sur 500 caractères.');
  });
});
