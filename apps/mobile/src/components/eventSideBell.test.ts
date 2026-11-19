import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const screen = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');
const page = readFileSync(join('src', 'components', 'EventPage.tsx'), 'utf8');
const guests = readFileSync(join('src', 'components', 'GuestsHeading.tsx'), 'utf8');

describe('the sidebar on an iPad on its side (sc-68052)', () => {
  it('draws no Search inside an event', () => {
    expect(frame).toMatch(/\n\s*search: organisation != null && !inEvent,\n/u);
  });

  it('keeps Search outside an event (sc-39534)', () => {
    expect(frame).not.toMatch(/\n\s*search: false,\n/u);
    expect(frame).not.toMatch(/\n\s*search: inEvent\b/u);
  });
});

describe('the bell on an iPad on its side (sc-68052)', () => {
  it('moves into the pane exactly where the frame draws no title, and so no bell', () => {
    expect(frame).toMatch(/if \(kind === 'tabletLandscape'\) \{\n\s*if \(untitled\) return null;/u);
    expect(frame).toMatch(/<BellInPane\.Provider value=\{sidebar && untitled\}>/u);
  });

  it('ends the title row of every area the event leaves untitled', () => {
    expect(screen).toMatch(/untitled=\{cardNamed \|\| titledInList\}/u);
    expect(screen).toMatch(/<GuestsHeading\b/u);
    expect(guests.match(/<PaneBell \/>/gu)).toHaveLength(2);
    expect(screen).toMatch(/\{cardNamed && event == null && <BellRow \/>\}/u);
    expect(page).toMatch(/card=\{<BellRow>\{card\}<\/BellRow>\}/u);
  });
});
