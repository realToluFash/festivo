import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join('src', 'components', file), 'utf8');
const screen = read('EventScreen.tsx');
const page = read('EventPage.tsx');
const inSight = page.slice(
  page.indexOf('function useOpenerInSight('),
  page.indexOf('const styles ='),
);

describe('an edit a link opened closes with its row in sight, where focus goes back to (sc-48600)', () => {
  it('hands the page each close, with the opener focus goes back to', () => {
    expect(screen).toContain('closedOnto={editing?.open === false ? editing : null}');
    expect(page).toContain('useOpenerInSight(closedOnto, toast);');
  });

  it('brings that opener into the page’s scroll at once, with a screen reader on', () => {
    expect(inSight).toContain('bringIntoView(scroll, closed.opener.current, false)');
    expect(inSight).toContain('isScreenReaderEnabled()');
  });

  it('leaves a close the page was not open for alone, so coming back to Overview scrolls nothing', () => {
    expect(inSight).toContain('const seen = useRef(closed);');
    expect(inSight).toContain(
      'if (closed == null || closed === seen.current || closed.saved === true) return;',
    );
  });
});

describe('after Save, the row rests 12pt above the saved toast, with a screen reader on (sc-86228)', () => {
  it('hands the page the toast’s top for the Save it says', () => {
    expect(screen).toContain('id: `saved-${saves.current}`,');
    expect(screen).toContain('over: closed,');
    expect(screen).toContain('onAt={setToastAt}');
    expect(screen).toContain('? toastOverPage(toast, toastAt)');
  });

  it('rests the row against that toast, at once and only with a screen reader on', () => {
    expect(inSight).toContain(
      'restOverToast(scroll, closed.opener.current, over, roomNow.current,',
    );
    expect(inSight).toContain('scrollTo({ y: rest.to, animated: false })');
    expect(inSight).toContain('if (!on || !current()) return;');
  });

  it('sends focus to the row from the rest, once it has landed and the edit has gone, not on the edit’s timer', () => {
    expect(screen).toContain('opener={editing.saved === true ? nobody : editing.opener}');
    expect(inSight).toContain('landedOr(scroll, rest.to, rested);');
    expect(inSight).toContain('if (rest == null || scroll == null) return rested();');
    expect(inSight).toContain('move: () => moveScreenReaderFocus(closed.opener.current),');
  });

  it('times focus by savedRowFocus, told of this close’s own toast layout (kit/savedRowFocus.test.ts)', () => {
    expect(inSight).toContain('latestMs: SAVED_FOCUS_LATEST_MS,');
    expect(inSight).toContain('focus.current.timing.toastLaidOut();');
    expect(inSight).toContain('timing.stop();');
  });

  it('asks no room under a point, which lays out nothing and would hold the rest', () => {
    expect(inSight).toContain('const wanted = rest.room < 1 ? 0 : Math.ceil(rest.room);');
  });

  it('brings that row into sight before focus goes back to it, as a close without Save does', () => {
    expect(inSight).toContain(
      'found == null || scroll == null ? rested() : landedOr(scroll, found.to, rested),',
    );
  });

  it('takes away the room at the page’s foot as the toast goes', () => {
    expect(inSight).toContain('laidOut.current = () => keepInsideEnd(scroll);');
  });
});
