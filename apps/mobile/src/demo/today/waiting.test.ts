import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { momentOf, sayIn } from '../today.ts';
import { readEnds, waitingCover, waitingOf } from './waiting.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const gb = sayIn('en-GB');

describe('Today while its events load or fail', () => {
  it('takes only the two states it draws', () => {
    expect(waitingOf('loading')).toBe('loading');
    expect(waitingOf('failed')).toBe('failed');
    expect(waitingOf('loaded')).toBeNull();
    expect(waitingOf(undefined)).toBeNull();
  });

  it('loads on Try again, or fails again when asked to', () => {
    expect(readEnds(undefined)).toBe('loaded');
    expect(readEnds('fails')).toBe('failed');
  });

  it('keeps the date and the greeting, and says nothing the events would have said', () => {
    const loaded = momentOf('plan', gb, i18n.t);
    const cover = waitingCover(loaded);

    expect(cover.eyebrow).toBe(loaded.eyebrow);
    expect(cover.hello).toBe(loaded.hello);
    expect(cover.lead).toBeNull();
    expect(cover.sub).toBe('');
    expect(cover.events).toEqual([]);
    expect(cover.needs).toBeNull();
  });

  it('never draws Now, even from the event day', () => {
    const cover = waitingCover(momentOf('day', gb, i18n.t));

    expect(cover.kind).toBe('plan');
    expect(cover.now).toBeNull();
    expect(cover.run).toBeNull();
  });
});
