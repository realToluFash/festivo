import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { type Action, MESSAGES_STATES, messagesStateOf, reduce, startOf } from './MessagesModel.ts';
import { TOKENS, piecesOf } from './MessagesSample.ts';
import { W } from './MessagesWords.ts';
import {
  FIRST_PREVIEW,
  PREVIEW_AS,
  chosen,
  coverFor,
  filledAs,
  filledIn,
  languageLine,
  noticeFor,
  optionOf,
  previewAsLeft,
  previewLines,
  previewOf,
  previewOffOf,
  retried,
  typedBraces,
} from './PreviewModel.ts';
import { BRACED_BODY, DATED_BODY, PREVIEW_PEOPLE } from './PreviewSample.ts';
import { PW, TOKEN_LINE, sayPreview } from './PreviewWords.ts';

const SC_3960 = [
  'insert',
  'previewAs',
  'previewGreetAs',
  'previewChose',
  'previewLoading',
  'previewFailed',
  'previewGone',
  'previewGoneLast',
  'previewMarkup',
  'typedBraces',
  'previewBraces',
  'noTokens',
];
const ONLY_OURS =
  'Only Soirely’s own words are translated. Yours show on their page exactly as you wrote them.';
const REST =
  'Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.';

const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');
const opened = (state: string, wide = true) => {
  const m = startOf(messagesStateOf(state), wide);
  const as = previewOf(m);

  return { m, as, person: PREVIEW_PEOPLE[as.who], body: m.draft?.body ?? '' };
};

describe('sc-3960’s states', () => {
  it('follow the spec’s, each read from ?state= and linked from the demo home', () => {
    const at = MESSAGES_STATES.indexOf('insert');

    expect(MESSAGES_STATES.slice(at, at + SC_3960.length)).toEqual(SC_3960);
    for (const state of SC_3960) {
      expect(messagesStateOf(state)).toBe(state);
      expect(MESSAGES_BOARDS.find((board) => board.state === state)?.href).toBe(
        `/demo/events/evt-wed-4?area=messages&state=${state}`,
      );
    }
  });

  it('open the composer for Insert and a typed {Greeting}, and the preview for the rest', () => {
    expect(startOf('insert', true)).toMatchObject({
      open: { kind: 'draft' },
      inserting: true,
      draft: { step: 'write' },
    });
    expect(startOf('typedBraces', false).draft).toMatchObject({ step: 'write', body: BRACED_BODY });
    expect(startOf('previewGoneLast', false).draft?.step).toBe('write');
    for (const state of SC_3960.filter(
      (one) => !['insert', 'typedBraces', 'previewGoneLast'].includes(one),
    ))
      expect(opened(state).m.draft?.step).toBe('preview');
  });
});

describe('Insert (sc-3960)', () => {
  it('offers the four tokens, each with its line, in the copy’s words', () => {
    expect(TOKENS.map((token) => [token, TOKEN_LINE[token]])).toEqual([
      ['Greeting', 'Their Greet as, or their full name if they have none'],
      ['Event', 'The event’s name'],
      ['Date', 'The event’s day, or its days'],
      ['Hosts', 'The event’s hosts'],
    ]);
  });

  it('opens and closes, the words untouched', () => {
    const write = startOf('write', true);

    expect(write.inserting).toBeUndefined();
    expect(reduce(write, { type: 'inserting', open: true }).inserting).toBe(true);
    expect(reduce(startOf('insert', false), { type: 'inserting', open: false })).toMatchObject({
      inserting: false,
      draft: write.draft,
    });
  });

  it('is a menu on the iPad and a sheet headed Insert with Cancel on the phone, each row named by its word and line', () => {
    const parts = source('WriteItOnce.tsx');

    expect(parts).toContain('<InsertRows role="menuitem"');
    expect(parts).toContain('<InsertRows role="button" inSheet');
    expect(parts).toContain('<SheetBody title={W.insert} close={W.cancel}');
    expect(parts).toContain('accessibilityLabel={`${token}, ${TOKEN_LINE[token]}`}');
  });

  it('gives focus back to the field, the caret just after the new token (as #1478 merged)', () => {
    expect(source('MessagesScreen.tsx')).toMatch(
      /const after = at \+ run\.length;[\s\S]*bodyRef\.current\?\.focus\(\);\s*bodyRef\.current\?\.setSelection\(after, after\);/u,
    );
  });
});

describe('Preview as (sc-3960)', () => {
  it('offers the people in To, A to Z, each with their language named in the reader’s', () => {
    expect(PREVIEW_AS.map((person) => optionOf(person))).toEqual([
      'Amaka Eze · English',
      'Bisi Adewale · English',
      'Camille Dubois · French',
      'Kemi Bankole · English',
      'Kwame Mensah · English',
      'Lucía Ortega · Spanish',
    ]);
  });

  it('names a language as the app does: on its own in the option, in a sentence in the line', () => {
    const camille = PREVIEW_PEOPLE.camille;

    expect(optionOf(camille)).toBe('Camille Dubois · French');
    expect(languageLine(camille)).toBe('In French, the language they chose on their page.');
    expect(optionOf(camille, 'fr')).toBe('Camille Dubois · Français');
    expect(languageLine(camille, 'fr')).toBe('In français, the language they chose on their page.');
    expect(optionOf(PREVIEW_PEOPLE.lucia, 'fr')).toBe('Lucía Ortega · Espagnol');
    expect(languageLine(PREVIEW_PEOPLE.lucia, 'fr')).toBe(
      'In espagnol, the language you set for them.',
    );
    expect(source('PreviewModel.ts')).not.toMatch(/DisplayNames/u);
  });

  it('reads its iPad options as menu items with selected, as Insert’s rows; buttons in the phone’s sheet', () => {
    expect(source('WriteItOnce.tsx')).toMatch(
      /accessibilityRole=\{inSheet \? 'button' : 'menuitem'\}\s*accessibilityState=\{\{ selected: on \}\}/u,
    );
  });

  it('opens on Kwame Mensah, as B’s preview did, and previewAs opens on the five', () => {
    expect(previewOf(startOf('preview', true))).toEqual(FIRST_PREVIEW);
    expect(opened('previewAs').as).toMatchObject({ who: 'kwame', choosing: true });
  });

  it('fills in someone new first, and keeps them through Edit and Preview', () => {
    const { m, as } = opened('previewAs');
    const next = chosen(as, 'camille');
    const actions: Action[] = [
      { type: 'previewing', previewing: next },
      { type: 'edit' },
      { type: 'preview' },
    ];

    expect(next).toEqual({ who: 'camille', choosing: false, filling: true, held: false });
    expect(chosen(as, 'kwame')).toMatchObject({ choosing: false, filling: false });
    expect(sayPreview.filling('Camille Dubois')).toBe('Filling it in for Camille Dubois…');
    expect(previewOf(actions.reduce(reduce, m)).who).toBe('camille');
  });

  it('says it could not fill it in for Camille Dubois, and Try again fills it in for her', () => {
    const { as } = opened('previewFailed');

    expect(as).toMatchObject({ who: 'camille', failed: true, filling: false });
    expect(sayPreview.failed('Camille Dubois')).toBe('We could not fill it in for Camille Dubois.');
    expect(PW.failedLine).toBe('Check your connection and try again.');
    expect(W.tryAgain).toBe('Try again');
    expect(retried(as)).toEqual({ ...as, failed: undefined, filling: true });
    expect(retried(as).failed).toBeUndefined();
    expect(chosen(as, 'camille')).toMatchObject({ who: 'camille', filling: true });
    expect(chosen(as, 'bisi').failed).toBeUndefined();
  });

  it('drops someone no longer a guest from Preview as and fills it in for the first left, A to Z', () => {
    const { m, as } = opened('previewGone');

    expect(as).toMatchObject({ who: 'amaka', goneSaid: 'camille', filling: false });
    expect(sayPreview.noLongerGuest(PREVIEW_PEOPLE.camille.name, PREVIEW_PEOPLE.amaka.name)).toBe(
      'Camille Dubois is no longer a guest, so it is filled in for Amaka Eze instead.',
    );
    expect(previewAsLeft(as).map((one) => one.name)).toEqual([
      'Amaka Eze',
      'Bisi Adewale',
      'Kemi Bankole',
      'Kwame Mensah',
      'Lucía Ortega',
    ]);

    const lucia = chosen(as, 'lucia');
    expect(lucia.goneSaid).toBeUndefined();
    expect(filledIn(lucia)).toMatchObject({
      who: 'amaka',
      filling: true,
      goneSaid: 'lucia',
      dropped: ['camille', 'lucia'],
    });
    expect(filledIn(chosen(as, 'bisi'))).toMatchObject({ who: 'bisi', filling: false });
    expect(previewOf(reduce(m, { type: 'edit' })).goneSaid).toBeUndefined();
    expect(previewOf(reduce(m, { type: 'edit' })).dropped).toEqual(['camille']);
  });

  it('closes the preview when nobody is left, and Preview says why beside it', () => {
    const { m, as } = opened('previewGoneLast');
    const last = { ...as, who: 'kwame' as const, gone: ['kwame' as const] };
    const everyoneElse = PREVIEW_AS.filter((one) => one.key !== 'kwame').map((one) => one.key);

    expect(m.draft?.step).toBe('write');
    expect(previewOffOf(m)).toBe(
      'Camille Dubois is no longer a guest, so there is nobody to preview it as.',
    );
    expect(reduce(m, { type: 'preview' })).toBe(m);
    expect(previewOffOf(reduce(m, { type: 'chooseTo', to: 'all' }))).toBeUndefined();
    expect(filledIn({ ...last, dropped: everyoneElse, filling: true }).nobodyLeft).toBe(
      'Kwame Mensah',
    );
    expect(previewOffOf(opened('previewGone').m)).toBeUndefined();
  });

  it('holds previewLoading still, filling it in for Camille Dubois', () => {
    expect(opened('previewLoading').as).toMatchObject({
      who: 'camille',
      filling: true,
      held: true,
    });
  });

  it('is read by its name and the person shown, and starts focus on them when open', () => {
    const parts = source('WriteItOnce.tsx');

    expect(parts).toContain('accessibilityValue={{ text: shown }}');
    expect(parts).toContain('accessibilityState={{ expanded: open }}');
    expect(parts).toContain('accessibilityState={{ selected: on }}');
    expect(parts).toContain('moveScreenReaderFocus(shownRef.current)');
    expect(parts).toContain('<SheetBody title={PW.previewAs} close={W.cancel}');
    expect(source('Preview.tsx')).toContain('useReadOut(words)');
  });
});

describe('the preview’s lines, in sc-3960’s order', () => {
  it('say the host’s words show on the page as written (reworded 7 Nov)', () => {
    expect(W.onlyOurs).toBe(ONLY_OURS);
  });

  it('greet Bisi Adewale by her Greet as, in the organisation’s language', () => {
    const { person, body } = opened('previewGreetAs');

    expect(filledAs(body, person)).toBe(
      `Auntie Bisi, a few things before Thursday, Nov 5. ${REST}`,
    );
    expect(previewLines(body, person)).toEqual([
      'Greeted as “Auntie Bisi”, their Greet as.',
      'In English, your organisation’s language, as no language is set for them.',
      ONLY_OURS,
    ]);
  });

  it('give Camille Dubois the Date in French and the language she chose, Soirely’s words as stand-ins', () => {
    const { person, body } = opened('previewChose');

    expect(filledAs(body, person)).toBe(
      `Camille Dubois, a few things before [jeudi 5 nov.]. ${REST}`,
    );
    expect(coverFor(person)).toBe('[jeu. 5 nov.] · 18:00 · The Landmark');
    expect(coverFor(PREVIEW_PEOPLE.kwame)).toBe('Thu, Nov 5 · 18:00 · The Landmark');
    expect(noticeFor(person).button).toBe('[Le lire sur votre page]');
    expect(previewLines(body, person)).toEqual([
      'Greeted as Camille Dubois, their full name. They have no Greet as.',
      'In French, the language they chose on their page.',
      ONLY_OURS,
    ]);
  });

  it('show a Greet as with markup as text, on the page and in its line', () => {
    const { person, body } = opened('previewMarkup');

    expect(filledAs(body, person).startsWith('Kemi "KB" <Bankole> & Co, a few things')).toBe(true);
    expect(previewLines(body, person).slice(0, 2)).toEqual([
      'Greeted as “Kemi "KB" <Bankole> & Co”, their Greet as.',
      'In English, the language you set for them.',
    ]);
  });

  it('keep the inserted Greeting one token and the typed {Greeting} text', () => {
    expect(piecesOf(BRACED_BODY).filter((piece) => piece.token)).toEqual([
      { token: true, text: 'Greeting' },
    ]);
    expect(typedBraces(BRACED_BODY)).toBe(true);
    expect(typedBraces(DATED_BODY)).toBe(false);
  });

  it('preview typed braces as typed, with the braces line last', () => {
    const { person, body } = opened('previewBraces');

    expect(filledAs(body, person)).toBe(
      'Kwame Mensah, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. {Greeting}, if anything changes for you, answer here.',
    );
    expect(previewLines(body, person)).toEqual([
      'Greeted as Kwame Mensah, their full name. They have no Greet as.',
      'In English, the language you set for them.',
      ONLY_OURS,
      PW.braces,
    ]);
    expect(PW.braces).toBe(
      'Anything you type in braces shows exactly as typed. To fill something in for each guest, use Insert.',
    );
  });

  it('say there is nothing to fill in, and no Greeted line, for a message with no token', () => {
    const { person, body } = opened('noTokens');

    expect(filledAs(body, person)).toBe(`A few things before Thursday. ${REST}`);
    expect(previewLines(body, person)).toEqual([
      'In English, the language you set for them.',
      ONLY_OURS,
      'Nothing to fill in, so every guest gets exactly these words.',
    ]);
  });
});
