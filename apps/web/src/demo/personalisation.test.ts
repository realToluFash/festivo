import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PERSONALISATION_PAGES,
  PERSONALISATION_STATES,
  SCHEMES,
  SCHEME_ORDER,
  keyStep,
  nextScheme,
  notSaved,
  personalisationStart,
  statusLine,
} from './personalisation.ts';

const TOKENS = readFileSync(join(import.meta.dirname, '..', 'tokens.css'), 'utf8');

function token(scheme: string, name: string): string | undefined {
  const block = new RegExp(`:root\\[data-scheme='${scheme}'\\] \\{([^}]*)\\}`, 'u').exec(
    TOKENS,
  )?.[1];

  return new RegExp(`--${name}: ([^;]+);`, 'u').exec(block ?? '')?.[1];
}

describe('Personalisation’s colours (sc-30441)', () => {
  it('offers B’s eight schemes in the boards’ reading order', () => {
    expect(SCHEME_ORDER.map((key) => SCHEMES[key].name)).toEqual([
      'Violet',
      'Cobalt',
      'Garden',
      'Citrus',
      'Berry',
      'Black tie',
      'Sorbet',
      'Terracotta',
    ]);
  });

  it.each(SCHEME_ORDER)('draws %s with the accent and page tokens.css gives it', (key) => {
    expect(SCHEMES[key].accent).toBe(token(key, 'colorAccent'));
    expect(SCHEMES[key].page).toBe(token(key, 'colorPage'));
  });

  it('writes dark words exactly where the scheme’s own ink is', () => {
    for (const key of SCHEME_ORDER.filter((one) => SCHEMES[one].dark)) {
      expect(SCHEMES[key].on).toBe(token(key, 'colorInk'));
      expect(SCHEMES[key].band).toBeNull();
    }
    expect(SCHEME_ORDER.filter((key) => SCHEMES[key].dark)).toEqual(['blacktie', 'sorbet']);
  });

  it('moves forward on Right and Down, back on Left and Up, and nowhere on other keys', () => {
    expect(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Tab', ' '].map(keyStep)).toEqual([
      1,
      1,
      -1,
      -1,
      null,
      null,
    ]);
  });

  it('walks the swatches in reading order and wraps at both ends', () => {
    expect(nextScheme(nextScheme('violet', 1), 1)).toBe('garden');
    expect(nextScheme('terracotta', 1)).toBe('violet');
    expect(nextScheme('violet', -1)).toBe('terracotta');
    expect(nextScheme('citrus', -1)).toBe('garden');
  });

  it('says what the pick means under its card', () => {
    expect(statusLine('violet', 'violet')).toBe('In use now. Pick another to see it here.');
    expect(statusLine('garden', 'violet')).toBe('Not saved yet. Save puts Garden on every page.');
    expect(notSaved('failed', 'garden', 'violet')).toBe(
      'Garden was not saved. Your colours stay Violet.',
    );
    expect(notSaved('offline', 'blacktie', 'violet')).toBe(
      'Black tie was not saved because you are offline. Your colours stay Violet.',
    );
  });

  it('opens a state link on what its board draws, and anything else as this visit left it', () => {
    expect(personalisationStart('')).toMatchObject({ scheme: undefined, pick: null });
    expect(personalisationStart('nonsense')).toMatchObject({ scheme: undefined, load: 'loaded' });
    expect(personalisationStart('never')).toMatchObject({ scheme: null, pick: null });
    expect(personalisationStart('chosen')).toMatchObject({ scheme: 'garden', saved: false });
    expect(personalisationStart('colours')).toMatchObject({ scheme: null, pick: 'violet' });
    expect(personalisationStart('picked')).toMatchObject({ pick: 'garden', keyed: true });
    expect(personalisationStart('saving')).toMatchObject({ pick: 'garden', saving: true });
    expect(personalisationStart('saved')).toMatchObject({ scheme: 'garden', saved: true });
    expect(personalisationStart('saveFailed')).toMatchObject({ unsaved: 'failed' });
    expect(personalisationStart('offline')).toMatchObject({ unsaved: 'offline' });
    expect(personalisationStart('escaped')).toMatchObject({ pick: null, step: true });
    expect(personalisationStart('loading')).toMatchObject({ scheme: 'garden', load: 'loading' });
    expect(personalisationStart('failed')).toMatchObject({ scheme: 'garden', load: 'failed' });
  });

  it('links every state from the demo’s home once', () => {
    const links = PERSONALISATION_PAGES.flatMap((page) => page.states.map((state) => state.to));

    expect(links).toEqual(
      PERSONALISATION_STATES.map((state) => `/demo/settings/personalisation?state=${state}`),
    );
  });
});
