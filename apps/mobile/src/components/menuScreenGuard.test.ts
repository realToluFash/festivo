import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'EventMenu.tsx'), 'utf8');
const parts = readFileSync(join('src', 'components', 'MenuPicksParts.tsx'), 'utf8');
const choose = readFileSync(join('src', 'components', 'MenuChoose.tsx'), 'utf8');

describe('the Menu offers choosing only with guests.manage (sc-3914)', () => {
  it('reads manage from what the picks allow', () => {
    expect(screen).toMatch(/const manage = access === 'manage';/u);
  });

  it('draws no Choose button without it', () => {
    const button = parts.split('export function ChooseButton(')[1]?.split('\nexport ')[0] ?? '';
    expect(button.split('\n  return (')[0]).toMatch(/\n\s*if \(!manage\) return null;\n/u);
  });

  it('hands manage to every Choose button', () => {
    const buttons = screen
      .split('<ChooseButton')
      .slice(1)
      .map((rest) => rest.split('/>')[0]);
    expect(buttons.length).toBeGreaterThan(2);
    for (const button of buttons) expect(button).toMatch(/manage=\{manage\}/u);
  });

  it('offers Choose who gets it only on a Children only row', () => {
    expect(parts).toMatch(
      /chooseWho=\{manage && row\.for === 'children' \? \(from\) => onChooseWho\(row, from\) : null\}/u,
    );
  });
});

describe('Given the default (sc-3914)', () => {
  it('counts the people given a default', () => {
    expect(screen).toMatch(
      /const givenCount = given\.reduce\(\(sum, party\) => sum \+ party\.people\.length, 0\);/u,
    );
  });

  it('shows only while somebody was given one', () => {
    expect(screen).toMatch(/\{givenCount > 0 && \(\n\s*<Card testID="menu\.given">/u);
  });
});

describe('Choose who gets it saves the ticked people (sc-3909)', () => {
  it('sends the ticked set, and nobody else', () => {
    expect(choose).toMatch(/api\.giveVariant\(eventId, row\.id, \[\.\.\.ticked\], confirmed\)/u);
  });
});

describe('Choose for them, refused (sc-3914)', () => {
  const chooseFor = choose.split('export function ChooseFor(')[1]?.split('\nexport ')[0] ?? '';

  it('says so beside the choices, not instead of them', () => {
    expect(chooseFor).toMatch(
      /\{refused && <FailureLine words=\{t\('menuPicks\.refused'\)\} testID="menu\.choose\.refused" \/>\}\n\s*<\/SheetScrollView>/u,
    );
    expect(chooseFor).not.toMatch(/\{refused \?/u);
  });

  it('keeps Save, turned off, and offers no Close', () => {
    expect(chooseFor).toMatch(/off=\{refused\}\n\s*testID="menu\.choose\.save"/u);
    const actions = chooseFor.split('<SheetActions>')[1]?.split('</SheetActions>')[0] ?? '';
    expect(actions).toMatch(/\{phone && saveButton\}/u);
    expect(actions).not.toMatch(/menuPicks\.close/u);
  });
});

describe('the Menu as its demo draws it (sc-3914)', () => {
  it("puts the event's name above the title", () => {
    expect(screen.indexOf('{event.name}')).toBeLessThan(screen.indexOf("{t('eventNav.menu')}"));
  });

  it('says everyone is in once, under Who hasn’t picked', () => {
    expect(screen.match(/t\('menuPicks\.allIn'\)/gu)).toHaveLength(1);
  });

  it("shows a row's count as the number alone", () => {
    const row = parts.split('function CountRow(')[1]?.split('\nexport ')[0] ?? '';
    const count = row.split('style={split ? styles.countSplit : styles.count}>')[1] ?? '';
    expect(count.split('</Text>')[0]?.trim()).toBe("{t('menuPicks.number', { n: row.chosen })}");
  });

  it('says names need Guests read once, inside Needs the host', () => {
    expect(screen.match(/t\('menuPicks\.needsRead'\)/gu)).toHaveLength(1);
  });
});

describe('the poll while the Menu is open (sc-3914)', () => {
  it('lets a read in flight land, and skips a tick while one is out or the app is away', () => {
    expect(screen).toMatch(
      /if \(!out\.current && AppState\.currentState === 'active'\) read\(\);/u,
    );
  });

  it('ends a pull through a timer from when it started, so a fast failure does not eat the next press', () => {
    const landed = screen.split('const landed = () => {')[1]?.split('\n    };')[0] ?? '';
    expect(landed).toMatch(
      /pullEnds\.current = setTimeout\(\n\s*\(\) => setPulling\(false\),\n\s*Math\.max\(0, pulledAt\.current \+ PULL_SHOWN_MS - Date\.now\(\)\),\n\s*\);/u,
    );
    expect(landed.replace(/\(\) => setPulling\(false\)/u, '')).not.toMatch(/setPulling\(false\)/u);
  });

  it('drops a read that started before a save', () => {
    expect(screen).toMatch(
      /const onSaved = \(next: EventPicks, lines: Said\) => \{\n\s*drop\(\);/u,
    );
  });
});
