import { describe, expect, it, vi } from 'vitest';

import { schemes } from '../../theme/tokens.ts';
import {
  cardLine,
  cardSays,
  hearChoice,
  heldChoice,
  holdChoice,
  inUse,
  LOADING_MS,
  notSavedLine,
  PERSONALISATION_STATES,
  personalisationStart,
  personalisationStateOf,
  restartTold,
  RETRY_MS,
  SAVE_MS,
  sampleClient,
  saveOn,
  schemeOf,
  statusLine,
  swatchName,
  WORDS,
} from './PersonalisationModel.ts';
import { dotsOf, lookOf, reachOf, SCHEME_ORDER, stepOf } from './PersonalisationSchemes.ts';

const now = () => Promise.resolve();

describe('the eight schemes', () => {
  it('are the tokens’ schemes, in the boards’ order and by their names', () => {
    expect(SCHEME_ORDER).toEqual(Object.keys(schemes));
    expect(SCHEME_ORDER.map((scheme) => lookOf(scheme).name)).toEqual([
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

  it('take the accent, its words and the page from the tokens', () => {
    for (const scheme of SCHEME_ORDER) {
      expect(lookOf(scheme)).toMatchObject({
        accent: schemes[scheme].colorAccent,
        accentText: schemes[scheme].colorAccentText,
        page: schemes[scheme].colorPage,
      });
    }
  });

  it('word the card dark only on Black tie’s and Sorbet’s light grounds, which carry no wash', () => {
    expect(SCHEME_ORDER.filter((scheme) => lookOf(scheme).dark)).toEqual(['blacktie', 'sorbet']);
    expect(lookOf('citrus').wash).toEqual({ band: '#6E1E00', strength: 2.75 });
  });

  it('show the accent, two pieces and the page as dots', () => {
    expect(dotsOf(lookOf('garden'))).toEqual({
      colours: ['#1E6B4F', '#F4A7B9', '#FFD36B', '#FFFDF8'],
      ring: 'rgba(255,255,255,0.9)',
    });
    expect(dotsOf(lookOf('sorbet')).ring).toBe('#22152E80');
  });

  it('fill the step white with the accent’s words, or with the accent on a light ground', () => {
    expect(stepOf(lookOf('citrus')).ink).toBe('#C0400C');
    expect(stepOf(lookOf('blacktie')).fill).toBe('#141414');
  });

  it('size a glow to the farthest corner, as CSS does', () => {
    expect(reachOf({ x: 0, y: 0, colour: '#000000', fade: 0.5 })).toEqual({
      rx: Math.SQRT2,
      ry: Math.SQRT2,
    });
    expect(reachOf({ x: 1, y: 0.08, colour: '#000000', fade: 0.44 }).ry).toBeCloseTo(
      Math.SQRT2 * 0.92,
    );
  });
});

describe('the states a link opens', () => {
  it('reads each, and anything else as the page at rest', () => {
    for (const state of PERSONALISATION_STATES) expect(personalisationStateOf(state)).toBe(state);
    expect(personalisationStateOf('nonsense')).toBeNull();
    expect(personalisationStateOf(undefined)).toBeNull();
    expect(schemeOf('garden')).toBe('garden');
    expect(schemeOf('teal')).toBeNull();
  });

  it('opens on what this visit holds, and Violet when nothing was ever chosen', () => {
    expect(personalisationStart(null, null)).toEqual({
      choice: null,
      load: 'loaded',
      colours: null,
      saved: false,
    });
    expect(personalisationStart(null, 'berry').choice).toBe('berry');
    expect(inUse(null)).toBe('violet');
  });

  it('draws each board: Inês never chose, then picks Garden', () => {
    const at = (state: (typeof PERSONALISATION_STATES)[number]) =>
      personalisationStart(state, 'berry');

    expect(at('chosen')).toMatchObject({ choice: 'garden', saved: false, colours: null });
    expect(at('saved')).toMatchObject({ choice: 'garden', saved: true, colours: null });
    expect(at('colours')).toMatchObject({
      choice: null,
      colours: { picked: 'violet', phase: 'choosing' },
    });
    expect(at('picked').colours).toEqual({ picked: 'garden', phase: 'choosing' });
    expect(at('saving').colours).toEqual({ picked: 'garden', phase: 'saving' });
    expect(at('saveFailed').colours).toEqual({ picked: 'garden', phase: 'failed' });
    expect(at('offline').colours).toEqual({ picked: 'garden', phase: 'offline' });
    expect(at('loading')).toMatchObject({ choice: 'berry', load: 'loading' });
    expect(at('failed')).toMatchObject({ choice: 'berry', load: 'failed' });
  });
});

describe('the words', () => {
  it('name the colours in use, and whether they are a choice', () => {
    expect(cardSays('blacktie')).toBe('You see Soirely in Black tie');
    expect(cardLine(null, false)).toEqual({
      text: 'Soirely’s own colours, until you choose others.',
      done: false,
    });
    expect(cardLine('violet', false).text).toBe('Your choice. Violet is Soirely’s own.');
    expect(cardLine('garden', true)).toEqual({
      text: 'Saved. Every screen is in your colours now.',
      done: true,
    });
  });

  it('say what the pick means under its card', () => {
    expect(statusLine('violet', 'violet')).toBe('In use now. Pick another to see it here.');
    expect(statusLine('garden', 'violet')).toBe('Not saved yet. Save puts Garden on every screen.');
  });

  it('say what was not saved, why, and what stays', () => {
    expect(notSavedLine('failed', 'garden', 'violet')).toBe(
      'Garden was not saved. Your colours stay Violet.',
    );
    expect(notSavedLine('offline', 'garden', 'violet')).toBe(
      'Garden was not saved because you are offline. Your colours stay Violet.',
    );
  });

  it('read the swatch in use as current', () => {
    expect(swatchName('violet', 'violet')).toBe('Violet, current');
    expect(swatchName('garden', 'violet')).toBe('Garden');
  });

  it('use no em dash', () => {
    const all = [...Object.values(WORDS), restartTold('garden'), statusLine('garden', 'violet')];

    expect(all.filter((words) => words.includes('—'))).toEqual([]);
  });
});

describe('Save', () => {
  it('waits until the pick differs from the colours in use, and while a save is out', () => {
    expect(saveOn({ picked: 'violet', phase: 'choosing' }, 'violet')).toBe(false);
    expect(saveOn({ picked: 'garden', phase: 'choosing' }, 'violet')).toBe(true);
    expect(saveOn({ picked: 'garden', phase: 'saving' }, 'violet')).toBe(false);
    expect(saveOn({ picked: 'garden', phase: 'offline' }, 'violet')).toBe(true);
  });
});

describe('the sample account', () => {
  it('saves a pick and answers with it', async () => {
    await expect(sampleClient(null, null, now).save('garden')).resolves.toEqual({
      saved: true,
      choice: 'garden',
    });
  });

  it('refuses every save in a failed or an offline state', async () => {
    const failed = sampleClient('saveFailed', null, now);
    const offline = sampleClient('offline', null, now);

    await expect(failed.save('garden')).resolves.toEqual({ saved: false, refusal: 'failed' });
    await expect(failed.save('garden')).resolves.toEqual({ saved: false, refusal: 'failed' });
    await expect(offline.save('garden')).resolves.toEqual({ saved: false, refusal: 'offline' });
  });

  it('holds the first read while loading and the first save while saving, then answers quickly', async () => {
    const waited: number[] = [];
    const wait = (ms: number) => {
      waited.push(ms);
      return Promise.resolve();
    };
    const loading = sampleClient('loading', 'garden', wait);

    await expect(loading.read()).resolves.toBe('garden');
    await loading.read();
    await sampleClient('saving', null, wait).save('garden');
    await sampleClient(null, null, wait).save('garden');

    expect(waited).toEqual([LOADING_MS, RETRY_MS, LOADING_MS, SAVE_MS]);
  });
});

describe('the colours this visit holds', () => {
  it('tell the Settings list when they change, and only then', () => {
    holdChoice(null);
    const heard = vi.fn();
    const unhear = hearChoice(heard);

    holdChoice('garden');
    holdChoice('garden');
    expect(heldChoice()).toBe('garden');
    expect(heard).toHaveBeenCalledTimes(1);

    unhear();
    holdChoice(null);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
