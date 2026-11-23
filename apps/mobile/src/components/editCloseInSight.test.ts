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
    expect(page).toContain('useOpenerInSight(closedOnto);');
  });

  it('brings that opener into the page’s scroll at once, with a screen reader on', () => {
    expect(inSight).toContain('bringIntoView(scroll, closed.opener.current, false)');
    expect(inSight).toContain('isScreenReaderEnabled()');
  });

  it('leaves a close the page was not open for alone, so coming back to Overview scrolls nothing', () => {
    expect(inSight).toContain('const seen = useRef(closed);');
    expect(inSight).toContain('if (closed == null || closed === seen.current) return;');
  });
});
