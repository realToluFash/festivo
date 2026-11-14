import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const EVENT_SCREEN = join('src', 'components', 'EventScreen.tsx');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'demo' ? [] : sources(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

function frames(file: string): string[] {
  const text = readFileSync(file, 'utf8');

  return [...text.matchAll(/<AppFrame\b[\s\S]*?\n\s*>/gu)].map(([tag]) => tag);
}

const framed = [...sources('src'), ...sources('app')].filter((file) => frames(file).length > 0);

describe('a phone’s header title inside an event (sc-30413)', () => {
  it('is left out where the screen says its body names it, not by the lit tab', () => {
    const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');

    expect(frame).toMatch(/\n {4}untitled,\n/u);
    expect(frame).not.toMatch(/untitled:\s*inEvent/u);
  });

  it('stays on All dates, Edit details and every framed screen but the event’s Overview', () => {
    const untitled = framed.filter((file) => frames(file).some((tag) => /\buntitled\b/u.test(tag)));

    expect(framed).toContain(join('app', 'events', '[id]', 'dates.tsx'));
    expect(framed).toContain(join('src', 'components', 'EventFormScreen.tsx'));
    expect(untitled).toEqual([EVENT_SCREEN]);
  });

  it('on the Overview, hands the card’s name the focus the frame’s title had', () => {
    const screen = readFileSync(EVENT_SCREEN, 'utf8');

    expect(screen).toMatch(/const top = eventTop\(kind, area, opened\.kind\);/u);
    expect(screen).toMatch(/moveScreenReaderFocus\(cardName\.current \?\? title\.current\)/u);
    expect(screen).toMatch(/nameRef=\{cardNamed \? cardName : undefined\}/u);
  });
});
