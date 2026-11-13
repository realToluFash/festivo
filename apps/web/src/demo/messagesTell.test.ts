import { describe, expect, it } from 'vitest';

import { sampleEvent } from './events.ts';
import { GROUPS } from './messagesTo.ts';
import { NEW_PLACE, STARTS_LATER, changed, rowsInOrder, sectionsOf, seedOf } from './messages.ts';
import {
  READY,
  byName,
  dayStillToCome,
  failed,
  figuresArrive,
  mergeUntold,
  pressSend,
  sheetOf,
  tellSeedOf,
  titleOf,
  toldOfKind,
  withoutTold,
} from './messagesTell.ts';
import { TELL_STATES } from './messagesTellStates.ts';

describe('Tell guests, every kind (sc-4330)', () => {
  it('writes the fields as one message in the copy’s order, with no headings', () => {
    const sheet = sheetOf([NEW_PLACE, STARTS_LATER]);

    expect(sheet.parts).toBeNull();
    expect(sheet.lines).toEqual([
      'The start time is now 17:30 (was 18:00).',
      'The venue is now Rosewood London (was The Landmark).',
    ]);
    expect(sheet.hints).toContain('The email adds the new address, with Open in maps.');
    expect(titleOf(sheet.figures)).toBe('Tell 130 guests?');
  });

  it('gives each kind its own who, figures and title', () => {
    const callOff = sheetOf([toldOfKind('callOff')]);
    const menu = sheetOf([toldOfKind('menu')]);
    const link = sheetOf([toldOfKind('link')]);

    expect(callOff.who).toBe('Everyone invited.');
    expect(titleOf(callOff.figures)).toBe('Tell 142 guests?');
    expect(callOff.figures.unreachable).toHaveLength(9);
    expect(menu.figures.credits).toBe(0);
    expect(menu.figures.unreachable).toEqual([]);
    expect(link.who).toBeNull();
    expect(titleOf(link.figures)).toBe('Tell Kwame Mensah?');
    expect(sheetOf([toldOfKind('resume')]).who).toBe('Everyone who was told it was paused.');
    expect(sheetOf([toldOfKind('tables')]).hints).toContain(
      'Each guest’s own table is added under your message.',
    );
  });

  it('puts changes for different guests each under its item, counting each guest once', () => {
    const sheet = sheetOf([NEW_PLACE, toldOfKind('tables')]);

    expect(sheet.who).toBeNull();
    expect(sheet.parts?.map((part) => [part.heading, part.who])).toEqual([
      ['New venue', 'Invited guests, except those not coming.'],
      ['Tables shared', 'Coming guests who have a table.'],
    ]);
    expect(sheet.figures.count).toBe(130);
  });

  it('lists who cannot be reached in alphabetical order', () => {
    const names = byName(sheetOf([toldOfKind('callOff')]).figures.unreachable).map(
      (one) => one.name,
    );

    expect(names).toEqual([...names].sort((one, two) => one.localeCompare(two)));
    expect(byName(sheetOf([STARTS_LATER]).figures.unreachable).map((one) => one.name)).toEqual([
      'Joaquín Ruiz',
      'Sophie Laurent',
    ]);
  });

  it('sends nothing while the figures load, then says it was not sent yet', () => {
    const early = pressSend({ ...READY, figures: 'loading' });

    expect(early.result).toBe('none');
    expect(figuresArrive(early.flow).line).toBe('early');
    expect(pressSend(figuresArrive(early.flow)).result).toBe('sent');
  });

  it('loads the figures again when they failed, sending nothing', () => {
    const again = pressSend({ ...READY, figures: 'failed', line: 'figuresFailed' });

    expect(again.result).toBe('none');
    expect(again.flow.figures).toBe('loading');
    expect(again.flow.line).toBeNull();
  });

  it('sends again after no connection, finds an unconfirmed send already told, and refuses a refusal again', () => {
    expect(pressSend(failed('offline')).result).toBe('sent');
    expect(pressSend(failed('refused')).result).toBe('sent');
    expect(pressSend(failed('unconfirmed')).result).toBe('allTold');

    const refused = pressSend(failed('role'));

    expect(refused.result).toBe('none');
    expect(refused.flow.line).toBe('role');
  });

  it('keeps one banner: fields answer for each other, a resume answers for the pause', () => {
    expect(mergeUntold([STARTS_LATER], [STARTS_LATER, NEW_PLACE]).map((one) => one.item)).toEqual([
      'New start time',
      'New venue',
    ]);
    expect(withoutTold([STARTS_LATER, toldOfKind('pause')], [toldOfKind('resume')])).toEqual([
      STARTS_LATER,
    ]);
    expect(withoutTold([STARTS_LATER, toldOfKind('tables')], [NEW_PLACE])).toEqual([
      toldOfKind('tables'),
    ]);
  });

  it('opens End now’s sheet only while a later day is still to come', () => {
    const wedding = sampleEvent('evt-wed-4');

    if (wedding == null) throw new Error('no sample wedding');

    expect(dayStillToCome(wedding, new Date('2026-11-06T16:10:00Z'))).toBe(true);
    expect(dayStillToCome(wedding, new Date('2026-11-07T10:00:00Z'))).toBe(false);
  });

  it('seeds every state that opens a sheet with its changes', () => {
    const keys = TELL_STATES.map((one) => one.key);

    expect(keys).toHaveLength(39);
    expect(tellSeedOf('tellHeld')?.figures?.held).toBe(14);
    expect(tellSeedOf('sendOffline')?.note).toBe('Dinner is still at 20:00.');
    expect(tellSeedOf('untoldEvent')?.changes).toBeNull();
  });

  it('puts a change at the head of Needs you while anyone is unreached, and in Done once all are', () => {
    const row = rowsInOrder(sectionsOf(seedOf('changeRow'), GROUPS))[0];

    expect(row).toMatchObject({
      title: 'Change · New start time',
      line: '2 people didn’t get it',
      when: '09:41',
      tag: { word: 'Not reached · 2' },
    });
    expect(sectionsOf(seedOf('changeMerged'), GROUPS).needs[0]?.title).toBe('Change · 2 changes');

    const done = sectionsOf(seedOf('changeDone'), GROUPS).done[0];

    expect(done).toMatchObject({
      title: 'Change · Menu choices to make again',
      line: 'Reached 6 of 6',
    });
    expect(
      sectionsOf(changed(seedOf('changeRow'), { kind: 'open', id: 'change' }), GROUPS).needs[0]?.id,
    ).toBe('change');
  });
});
