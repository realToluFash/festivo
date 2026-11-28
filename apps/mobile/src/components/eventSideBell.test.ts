import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const screen = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');
const page = readFileSync(join('src', 'components', 'EventPage.tsx'), 'utf8');
const guests = readFileSync(join('src', 'components', 'GuestsHeading.tsx'), 'utf8');
const button = readFileSync(join('src', 'components', 'SearchButton.tsx'), 'utf8');

describe('the sidebar on an iPad on its side (sc-68052)', () => {
  it('draws no Search inside an event', () => {
    expect(frame).toMatch(
      /\n\s*search: searchOffered\(\{ organisation, pausedIn \}\) && !inEvent,\n/u,
    );
  });

  it('keeps Search outside an event (sc-39534)', () => {
    expect(frame).not.toMatch(/\n\s*search: false,\n/u);
    expect(frame).not.toMatch(/\n\s*search: inEvent\b/u);
  });
});

describe('the Search on a phone and upright (sc-82858)', () => {
  it('is absent while the member is suspended from the organisation in use', () => {
    expect(button).toMatch(/if \(!searchOffered\(signedIn\)\) return null;/u);
  });
});

describe('the bell on an iPad on its side (sc-68052)', () => {
  it('moves into the pane exactly where the frame draws no title, and so no bell', () => {
    expect(frame).toMatch(/if \(kind === 'tabletLandscape'\) \{\n\s*if \(untitled\) return null;/u);
    expect(frame).toMatch(
      /<BellInPane\.Provider\s+value=\{sidebar && untitled && !bareList\}\s*>/u,
    );
  });

  it('draws none in the pane of a missing event, which stands in the bare Events frame (sc-80863)', () => {
    expect(screen).toMatch(/bareList=\{!top\.inEvent\}/u);
  });

  it('ends the title row of every area the event leaves untitled', () => {
    expect(screen).toMatch(/untitled=\{cardNamed \|\| titledInList\}/u);
    expect(screen).toMatch(/<GuestsHeading\b/u);
    expect(guests.match(/<PaneBell \/>/gu)).toHaveLength(2);
    expect(screen).toMatch(/\{cardNamed && event == null && !bare && <BellRow \/>\}/u);
    expect(page).toMatch(/card=\{<BellRow>\{card\}<\/BellRow>\}/u);
  });
});

describe('the bell on a phone, paused under a pushed screen (sc-85005)', () => {
  it('ends ‹’s row, and no title row is drawn under it', () => {
    expect(frame).toMatch(
      /\{paused \? \(\n\s*<View style=\{styles\.titleRow\}>\n\s*<View style=\{styles\.fill\}>\{backView\}<\/View>\n\s*<BellButton \/>\n\s*<\/View>\n\s*\) : \(/u,
    );
  });
});
