import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EVENT as DOOR } from '../doorCode/DoorCodeModel.ts';
import { DOOR_WEDDING, EVENTS, sampleEvent } from '../events/EventsSample.ts';

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

  it('draws /demo/people in its event’s frame on the phone too, the door code’s states in theirs', () => {
    expect(route).toMatch(/return \(\n\s*<EventsShell>\n\s*<EventScreen/u);
    expect(route).toMatch(/door == null \? SAMPLE_EVENT_ID : DOOR_WEDDING\.id/u);
    expect(route).not.toMatch(/PeopleSection|PageToast/u);
    expect(frame).toMatch(/if \(inEvent != null\)\n/u);
  });
});

describe('the door code’s event is one the event’s frame can open (sc-72)', () => {
  it('is Joana & Rui’s wedding, as the door code’s sample has it, and not one of the twenty', () => {
    expect(sampleEvent(DOOR.id)?.name).toBe(DOOR.name);
    expect(DOOR_WEDDING.venue?.name).toBe(DOOR.venue.split(',')[0]);
    expect(DOOR_WEDDING.timeZone).toBe('Europe/Lisbon');
    expect(EVENTS.some((one) => one.id === DOOR.id)).toBe(false);
  });
});
