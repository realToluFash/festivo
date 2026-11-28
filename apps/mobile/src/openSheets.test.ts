import { describe, expect, it } from 'vitest';

import { noteWhere } from './where.ts';
import { holdLeaving, keptEditing } from './leaveHeld.ts';
import { noteOpenSheet, noteSheetSettled, openFromOutside } from './openSheets.ts';

describe('a screen opened from outside the app while a sheet is open', () => {
  it('closes a sheet that holds no change, then opens the screen', () => {
    const seen: string[] = [];
    const forget = noteOpenSheet(() => seen.push('closed'));
    noteWhere('/events/1');

    openFromOutside('/notifications', () => seen.push('opened'));
    forget();

    expect(seen).toEqual(['closed', 'opened']);
  });

  it('opens nothing and keeps the sheet when the place is the screen showing', () => {
    const seen: string[] = [];
    const forget = noteOpenSheet(() => seen.push('closed'));
    noteWhere('/events/1');

    openFromOutside(
      '/events/1/',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );
    forget();

    expect(seen).toEqual(['stayed']);
  });

  it('asks a form holding a change first, and closes and opens nothing before it is answered', () => {
    const seen: string[] = [];
    const forget = noteOpenSheet(() => seen.push('closed'));
    noteWhere('/events/1');
    const release = holdLeaving(() => {});

    openFromOutside(
      '/notifications',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );
    expect(seen).toEqual([]);
    release();
    forget();
  });

  it('keeps the sheet when the reader stays', () => {
    const seen: string[] = [];
    const forget = noteOpenSheet(() => seen.push('closed'));
    noteWhere('/events/1');
    const release = holdLeaving(() => {});

    openFromOutside(
      '/notifications',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );
    keptEditing();
    release();
    forget();

    expect(seen).toEqual(['stayed']);
  });

  it('opens a place that asks the screen showing for an area, as the guests push does', () => {
    const seen: string[] = [];
    noteWhere('/events/1');

    openFromOutside('/events/1?area=guests&filter=changed&since=1', () => seen.push('opened'));

    expect(seen).toEqual(['opened']);
  });

  it('opens a place that differs from the one showing only by its query', () => {
    const seen: string[] = [];
    noteWhere('/events/1');

    openFromOutside(
      '/events/1?area=guests',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );

    expect(seen).toEqual(['opened']);
  });

  it('opens nothing when the place is the one showing, query included', () => {
    const seen: string[] = [];
    noteWhere('/events/1', 'filter=changed&area=guests');

    openFromOutside(
      '/events/1?area=guests&filter=changed',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );

    expect(seen).toEqual(['stayed']);
  });

  it('waits for a held sheet, then opens the screen once the sheet closes on its success', () => {
    const seen: string[] = [];
    let held = true;
    const forget = noteOpenSheet(
      () => seen.push('closed'),
      () => held,
    );
    noteWhere('/events/1');

    openFromOutside(
      '/notifications',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );
    expect(seen).toEqual([]);
    held = false;
    forget();

    expect(seen).toEqual(['opened']);
  });

  it('keeps a held sheet and opens nothing when its answer is a refusal', () => {
    const seen: string[] = [];
    let held = true;
    const forget = noteOpenSheet(
      () => seen.push('closed'),
      () => held,
    );
    noteWhere('/events/1');

    openFromOutside(
      '/notifications',
      () => seen.push('opened'),
      () => seen.push('stayed'),
    );
    held = false;
    noteSheetSettled();
    forget();

    expect(seen).toEqual(['stayed']);
  });
});
