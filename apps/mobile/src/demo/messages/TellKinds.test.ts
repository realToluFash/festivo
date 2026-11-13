import { init } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';

import { sampleEvent } from '../events/EventsSample.ts';
import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { reduce, sectionsOf, startOf } from './MessagesModel.ts';
import { W } from './MessagesWords.ts';
import { tellChange } from './TellChange.ts';
import {
  RUN,
  TELL_KINDS,
  changeTitle,
  eventBehind,
  fieldEvents,
  figuresArrive,
  pressSend,
  runOf,
  sendingWords,
  sheetOf,
  tellTitle,
} from './TellKinds.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const wedding = sampleEvent('evt-wed-4');
if (wedding == null) throw new Error('The sample has the wedding.');

const sheet = (state: (typeof TELL_KINDS)[number]) => {
  const fields = fieldEvents(state, wedding);

  return sheetOf(state, fields == null ? null : tellChange(fields.told, fields.now, 'en-US'));
};

describe('sc-4330: tell guests about a change', () => {
  it('every kind is a state with its board', () => {
    const states = MESSAGES_BOARDS.map((board) => board.state);
    expect(states).toEqual(expect.arrayContaining([...TELL_KINDS]));
  });

  it('the title waits for the figures, then counts or names', () => {
    const change = sheet('figuresLoading');
    expect(tellTitle(change, runOf('figuresLoading'))).toBe('Tell guests?');
    expect(tellTitle(change, runOf('figuresFailed'))).toBe('Tell guests?');
    expect(tellTitle(change, RUN)).toBe('Tell 130 guests?');
    expect(tellTitle(sheet('tellLink'), RUN)).toBe('Tell Kwame Mensah?');
    expect(tellTitle(sheet('tellMenuOne'), RUN)).toBe('Tell Lucía Ortega?');
  });

  it('Send pressed while the figures load sends nothing, and says so once they show', () => {
    const pressed = pressSend(runOf('figuresLoading'));
    expect(pressed.kind).toBe('run');
    if (pressed.kind !== 'run') return;
    const shown = figuresArrive(pressed.run);
    expect(shown.figures).toBe('shown');
    expect(shown.line).toEqual({ words: W.pressedEarly, alert: false });
    expect(pressSend(shown)).toEqual({ kind: 'close', told: 'sent' });
  });

  it('Send after the figures failed loads them again, sending nothing', () => {
    const pressed = pressSend(runOf('figuresFailed'));
    expect(pressed).toEqual({
      kind: 'run',
      run: expect.objectContaining({ figures: 'loading', line: null }),
    });
  });

  it('a failed Send keeps the sheet and the note, with an alert line', () => {
    for (const state of [
      'sendOffline',
      'sendUnconfirmed',
      'sendRefusedRole',
      'sendRefused',
    ] as const) {
      const run = runOf(state);
      expect(run.line?.alert).toBe(true);
      expect(run.note).toBe('Dinner is still at 20:00.');
    }
    expect(runOf('sendRefusedEvent').line?.words).toBe(
      'Nothing was sent. This event is a draft. Make it live to write to your guests.',
    );
    expect(runOf('sendRefusedFinished').line?.words).toContain('more than 30 days ago');
    expect(runOf('sendRefusedDeleted').line?.words).toBe(
      'Nothing was sent. This event is not available.',
    );
  });

  it('a refusal stays refused; Send again after offline or a moment sends', () => {
    expect(pressSend(runOf('sendRefusedRole'))).toEqual({
      kind: 'run',
      run: expect.objectContaining({ tries: 1 }),
    });
    expect(pressSend(runOf('sendOffline'))).toEqual({ kind: 'close', told: 'sent' });
    expect(pressSend(runOf('sendUnconfirmed'))).toEqual({ kind: 'close', told: 'allTold' });
  });

  it('each kind carries the story’s words', () => {
    expect(sheet('tellVenueGone').lines).toEqual([
      'The venue is to be confirmed (was The Landmark).',
    ]);
    expect(sheet('tellVenueGone').what).toEqual([W.venueTbc]);
    expect(sheet('tellDates').what).toEqual([W.newDate]);
    expect(sheet('tellCallOff').who).toBe(W.everyoneInvited);
    expect(sheet('tellLink').who).toBeNull();
    expect(sheet('tellTables').tables).toBe(true);
    const mixed = sheet('tellMixed');
    expect(mixed.parts?.map((part) => part.item)).toEqual([W.newVenue, W.tablesShared]);
    expect(mixed.who).toBeNull();
  });

  it('Send says who it is sending to', () => {
    expect(sendingWords(sheet('tellSeeWho'))).toBe('Sending to 130 guests.');
    expect(sendingWords(sheet('tellCallOff'))).toBe('Sending to 142 guests.');
  });

  it('the row is named for the change, Needs you until everyone is reached', () => {
    expect(changeTitle([W.newStartTime])).toBe('Change · New start time');
    expect(changeTitle([W.newStartTime, W.newVenue])).toBe('Change · 2 changes');
    const needs = sectionsOf(startOf('changeRow', false));
    expect(needs.needs[0]).toEqual({ kind: 'many', key: 'change' });
    const done = sectionsOf(startOf('changeDone', false));
    expect(done.done[0]).toEqual({ kind: 'many', key: 'change' });
    expect(done.needs).not.toContainEqual({ kind: 'many', key: 'change' });
  });

  it('Not now leaves the banner; Send leaves the row', () => {
    const open = startOf('tellSeeWho', false);
    expect(open.telling).toBe(true);
    expect(reduce(open, { type: 'notNow' }).untold).toBe(true);
    const sent = reduce(open, { type: 'tellSent' });
    expect(sent.untold).toBe(false);
    expect(sent.changeRow).not.toBeNull();
  });

  it('Pause leaves the page Paused, Call off leaves it over', () => {
    const now = new Date('2026-11-03T09:41:00Z');
    expect(eventBehind('tellPause', wedding, now).status).toBe('paused');
    expect(eventBehind('tellCallOff', wedding, now).status).toBe('ended');
  });
});
