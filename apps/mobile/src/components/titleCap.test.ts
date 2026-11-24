import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  capUnderTitle,
  reportTitle,
  titleCapKey,
  titleCapOn,
  titleSize,
} from '../layout/textSize.ts';
import { backScale, PILL_TEXT } from '../layout/focusedHeader.ts';
import { PAGE_TITLE } from './topTitle.ts';

const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const rows = readFileSync(join('src', 'components', 'SummaryRows.tsx'), 'utf8');
const event = readFileSync(join('src', 'components', 'EventScreen.tsx'), 'utf8');
const guests = readFileSync(join('src', 'components', 'GuestsHeading.tsx'), 'utf8');
const settings = readFileSync(join('src', 'components', 'SettingsHome.tsx'), 'utf8');
const title = readFileSync(join('src', 'components', 'Title.tsx'), 'utf8');
const calendar = readFileSync(join('src', 'components', 'CalendarScreen.tsx'), 'utf8');
const demoFrame = readFileSync(join('src', 'demo', 'settings', 'Frame.tsx'), 'utf8');
const demoMembers = readFileSync(join('src', 'demo', 'settings', 'MembersParts.tsx'), 'utf8');

const HEAD = 18;
const AX5 = 3.12;

function heading(cap: number | null, fontScale: number): number {
  return HEAD * capUnderTitle(cap ?? Infinity, HEAD, fontScale);
}

describe('nothing under a page title draws larger than the title (sc-67338)', () => {
  it('stops a section heading at the title’s drawn size at AX5, 43 not 56', () => {
    const title = titleSize(PAGE_TITLE, AX5);

    expect(title).toBe(43);
    expect(heading(title, AX5)).toBe(43);
    expect(heading(null, AX5)).toBeCloseTo(56.16);
  });

  it('never starts a heading under 18, even under a title stepped down below it', () => {
    expect(heading(15, AX5)).toBe(HEAD);
  });

  it('starts the heading from the cap, so it steps down by whole words from there', () => {
    expect(rows).toMatch(/<CappedWholeWords\s+size=\{HEAD_SIZE\}/u);
  });

  it('caps the frame’s body at the title’s size, and only where a title is drawn', () => {
    expect(frame).toMatch(/<TitleCap\.Provider value=\{cap\}>\s+\{!ownTop && switchedNotice\}/u);
    expect(frame).toMatch(
      /const cap = framed && \(titleCap\.drawn \|\| !untitled\) \? titleCap\.cap : null;/u,
    );
  });

  it('caps the demo’s Settings column at the title’s size, as the app’s frame does', () => {
    expect(demoFrame).toMatch(
      /<TitleCap\.Provider value=\{titleSize\(PAGE_TITLE, fontScale\)\}>\{column\}<\/TitleCap\.Provider>/u,
    );
  });

  it('caps the demo’s landscape Members pane at the title’s size, beside the column', () => {
    expect(demoMembers).toMatch(
      /export function NobodyPicked\(\) \{[^]*?<TitleCap\.Provider value=\{titleSize\(PAGE_TITLE, fontScale\)\}>\s+<View style=\{styles\.nobody\}>/u,
    );
  });

  it('keeps the pill and the bell of a scrolling top outside the cap', () => {
    expect(frame).toMatch(
      /<TitleCap\.Provider value=\{null\}>\s+<ScreenTop \{\.\.\.top\} style=\{style\} rowStyle=\{rowStyle\} \/>/u,
    );
  });

  it('caps an event area under the title its body draws', () => {
    expect(event.match(/<BodyTitle\b/gu)).toHaveLength(1);
    expect(guests.match(/<BodyTitle\b/gu)).toHaveLength(1);
  });
});

describe('the Back pill over a page title draws no larger than the title (sc-67471)', () => {
  it('stops the pill’s word at the title’s 43 at AX5, not about 53', () => {
    const title = titleSize(PAGE_TITLE, AX5);

    expect(PILL_TEXT * backScale(AX5, title)).toBe(43);
    expect(PILL_TEXT * backScale(AX5, null)).toBeGreaterThan(43);
  });

  it('leaves the pill as it was below the accessibility sizes', () => {
    expect(backScale(1.35, titleSize(PAGE_TITLE, 1.35))).toBe(1.35);
  });

  it('puts every Back the frame draws under the title’s cap', () => {
    expect(frame).toMatch(
      /<TitleCap\.Provider value=\{cap\}>\s+<Back\s+label=\{back\.label\}\s+onPress=\{back\.onPress\}\s+off=\{back\.off\}\s+besideShown=\{besideShown\}\s+testID="frame\.back"\s+\/>/u,
    );
    expect(frame.match(/<Back\b/gu)).toHaveLength(1);
    expect(
      frame.match(
        /<FrameBack back=\{back\} cap=\{cap\} besideShown=\{shownBeside\(besideBack\)\} \/>/gu,
      ),
    ).toHaveLength(4);
  });
});

describe('the cap a page’s title reported holds for that page and text size only (sc-67338)', () => {
  const guests = titleCapKey('phone|true|Guests', AX5);
  const overview = titleCapKey('phone|true|Overview', AX5);

  it('caps nothing reported until the title reports, and caps at the size it will draw meanwhile', () => {
    expect(titleCapOn(null, guests, PAGE_TITLE, AX5)).toEqual({ cap: 43, drawn: false });
  });

  it('caps at the size the title reported, stepped down below its own', () => {
    const drawn = reportTitle(null, guests, 30);

    expect(titleCapOn(drawn, guests, PAGE_TITLE, AX5)).toEqual({ cap: 30, drawn: true });
  });

  it('drops a report made on another page, so an event’s Overview is not capped by Guests’ title', () => {
    const drawn = reportTitle(null, guests, 30);

    expect(titleCapOn(drawn, overview, PAGE_TITLE, AX5).drawn).toBe(false);
  });

  it('drops a report made at another text size', () => {
    const drawn = reportTitle(null, guests, 30);
    const larger = titleCapKey('phone|true|Guests', 3.5);

    expect(titleCapOn(drawn, larger, PAGE_TITLE, 3.5)).toEqual({ cap: 43, drawn: false });
  });

  it('keeps the same report where the title says the same again, so nothing redraws', () => {
    const drawn = reportTitle(null, guests, 30);

    expect(reportTitle(drawn, guests, 30)).toBe(drawn);
    expect(reportTitle(drawn, guests, 28)).toEqual({ key: guests, size: 28 });
    expect(reportTitle(drawn, overview, 30)).toEqual({ key: overview, size: 30 });
  });
});

describe('every line under the cap wraps whole, and nothing is cut (sc-67338)', () => {
  it('steps the account card’s role down by whole words, so a long organisation is never broken', () => {
    expect(settings).toMatch(
      /<CappedWholeWords[^>]*>\s+\{t\('settings\.personRole', role\)\}\s+<\/CappedWholeWords>/u,
    );
  });

  it('starts a Settings row’s line no larger than its title draws, both split after a hyphen (sc-69816)', () => {
    expect(settings).toMatch(
      /<CappedWholeWords[^>]*\bonDrawn=\{setTitle\}[^>]*\bbreakAfterHyphens\s*>\s+\{row\.title\}/u,
    );
    expect(settings).toMatch(
      /<CappedWholeWords[^>]*\bunder=\{title\}[^>]*\bbreakAfterHyphens\s*>\s+\{row\.line\}/u,
    );
  });

  it('draws a label that changes size as a new text, so a moved cap never leaves the old size drawn (sc-69816)', () => {
    expect(title).toMatch(/<Text\s+\{\.\.\.rest\}\s+(?:\/\/[^\n]*\s+)?key=\{drawnSize\}/u);
  });

  it('measures a word afresh at each size and start, so a reading at the last one never sizes this one (sc-69816, sc-74113)', () => {
    expect(title).toMatch(
      /key=\{`\$\{look\.size \?\? ''\}\|\$\{look\.maxFontSizeMultiplier \?\? 1\}\|\$\{word\}`\}/u,
    );
  });

  it('wraps a row’s tag at the accessibility sizes rather than cut it', () => {
    expect(rows).toMatch(/const wraps = wrapsAlways \|\| atAccessibilitySizes\(fontScale\);/u);
  });
});

describe('an iPad’s Calendar title keeps its row from AX1 (sc-79265)', () => {
  it('passes Refreshing… and Subscribe under the title on an iPad at AX, beside it otherwise', () => {
    expect(calendar).toMatch(/const under = useAccessibilitySizes\(\) && kind !== 'phone';/u);
    expect(calendar).toMatch(
      /besideTitle=\{under \? undefined : ends\}\s+underTitle=\{under \? ends : undefined\}/u,
    );
  });
});
