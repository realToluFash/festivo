import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const frame = readFileSync(join('src', 'demo', 'people', 'PeopleFrame.tsx'), 'utf8');

describe('nothing under People’s title draws larger than the title (sc-67665)', () => {
  it('caps People in the event’s frame under its title, as the frame caps Guests', () => {
    expect(frame).toMatch(/const frameDrawn = usePageTitleDrawn\(\);[^]*?frameDrawn\?\.\(size\);/u);
    expect(frame).toMatch(/<PeopleTitle onDrawn=\{onDrawn\} \/>/u);
  });
});

const eventFrame = readFileSync(join('src', 'demo', 'events', 'EventFrame.tsx'), 'utf8');
const eventPage = readFileSync(join('src', 'demo', 'events', 'EventPage.tsx'), 'utf8');
const route = readFileSync(join('src', 'demo', 'people', 'Route.tsx'), 'utf8');

describe('on a phone, People keeps the event’s tab bar with More lit (sc-70351)', () => {
  it('opens People from the More sheet as an area of the frame, not a page of its own', () => {
    expect(eventFrame).not.toMatch(/router\.push\('\/demo\/people'\)/u);
    expect(eventFrame).toMatch(/onClose\(\);\s*onArea\(one\);/u);
  });

  it('opens People from Overview’s card in the frame on every layout', () => {
    expect(eventPage).not.toMatch(/area === 'people' && shell\.layout === 'phone'/u);
    expect(eventPage).toMatch(/if \(at === 'people'\)\n/u);
    expect(eventPage).toMatch(
      /onOpen=\{\(params\) => \{\s*setPeopleAt\(params\);\s*setAt\('people'\);/u,
    );
  });

  it('draws /demo/people in the sample event’s frame on the phone too, the door code’s event aside', () => {
    expect(route).toMatch(/if \(door == null\)\n\s*return \(\n\s*<EventsShell>/u);
    expect(frame).toMatch(/if \(inEvent != null\)\n/u);
  });
});
