import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const route = readFileSync(join('app', 'settings', 'data-and-control', 'audit-log.tsx'), 'utf8');
const overlays = readFileSync(join('src', 'components', 'SummaryOverlays.tsx'), 'utf8');

describe('‹ Audit log returns to the log with its entry still open (sc-83008)', () => {
  it('opens the event from the entry sheet without closing the sheet', () => {
    const sheet = route.slice(
      route.indexOf('<EntrySheet'),
      route.indexOf('/>', route.indexOf('<EntrySheet')),
    );
    expect(sheet).toMatch(/onEvent=\{openEvent\}/u);
    expect(sheet).not.toMatch(/onEvent=\{[^}]*setOpen\(null\)/u);
  });

  it('lets a task screen wait while another page is over it', () => {
    const screen = overlays.slice(overlays.indexOf('export function FocusedScreen('));
    expect(screen).toMatch(/\bwaitsAway\b/u);
  });
});
