import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const cover = readFileSync(join('src', 'components', 'TodayCover.tsx'), 'utf8');
const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const tabLabel = readFileSync(join('src', 'layout', 'tabLabel.ts'), 'utf8');
const title = readFileSync(join('src', 'components', 'Title.tsx'), 'utf8');
const pill = readFileSync(join('src', 'components', 'OrgPill.tsx'), 'utf8');
const run = readFileSync(join('src', 'components', 'TodayRun.tsx'), 'utf8');

describe('the tab bar’s labels at twice the text size (sc-37298)', () => {
  it('measures each label whole in SemiBold, capped at 20', () => {
    expect(tabLabel).toMatch(/export const TAB_LABEL = 12;/u);
    expect(tabLabel).toMatch(/export const TAB_LABEL_MOST = 20;/u);
    expect(cover).toMatch(
      /useWholeWords\(TAB_LABEL, tabLabelStart\(fontScale\), tabLabels\(props\), \{\s+weight: 'semibold',\s+\}\);/u,
    );
  });

  it('keeps that floor everywhere but the event’s bar (sc-71148)', () => {
    expect(cover).toMatch(
      /props\.stepsBelowDefault \? <SteppedTabBar \{\.\.\.props\} \/> : <DefaultTabBar \{\.\.\.props\} \/>/u,
    );
    expect(frame.match(/stepsBelowDefault/gu)).toHaveLength(1);
  });
});

describe('the event’s bar on a phone (sc-71148)', () => {
  it('measures every word in SemiBold at the start and draws all five at exactly the size that fits', () => {
    expect(cover).toMatch(/useMeasuredAt\(start, wordsIn\(tabLabels\(props\)\)\)/u);
    const measuredAt = /export function useMeasuredAt\([\s\S]*?\n\}\n/u.exec(title)?.[0] ?? '';
    expect(measuredAt).toMatch(
      /<MeasuredWords\s+words=\{words\}\s+size=\{start\}\s+weight="semibold"\s+allowFontScaling=\{false\}/u,
    );
    expect(cover).toMatch(
      /size: eventBarLabelSize\(fontScale, widest, slot\),\s+allowFontScaling: false,/u,
    );
  });
});

describe('the capsule the upright band is laid out beside (sc-91290)', () => {
  it('is as tall as the geometry LABEL_IN_BAND is built from', () => {
    const capsule = / {2}whiteCapsule: \{[\s\S]*?\n {2}\},/u.exec(cover)?.[0] ?? '';
    expect(capsule).toMatch(/minHeight: CAPSULE_HEIGHT,/u);
    expect(capsule).toMatch(/padding: tokens\.spaceXxs,/u);
    expect(capsule).not.toMatch(/padding(Vertical|Top|Bottom):/u);
  });
});

describe('the band’s tile while an invitation waits (sc-40298)', () => {
  it('draws the cover tile’s ring, so the band returns the same tile', () => {
    expect(cover).toMatch(/\{org\.waiting != null && <View style=\{styles\.tileRing\} \/>\}/u);
    expect(cover).toMatch(/if \(compact\) return tile;/u);
    expect(cover.match(/<View style=\{styles\.tileRing\} \/>/gu)).toHaveLength(1);
  });
});

describe('the greeting on the iPad’s side banner (sc-91291)', () => {
  it('grows the banner rather than clipping the greeting above it', () => {
    expect(cover).not.toMatch(/height: coverBody\(/u);
    const greeting = / {2}bannerGreeting: \{[\s\S]*?\n {2}\},/u.exec(cover)?.[0] ?? '';
    expect(greeting).not.toMatch(/position: 'absolute'/u);
  });
});

describe('the upright iPad’s pill from AX1 (sc-92314)', () => {
  it('takes the whole-words name beside the tabs, and the row keeps to the top while the pill grows down', () => {
    expect(cover).toMatch(/nameRoom=\{large \? uprightNameRoom\(room\) : undefined\}/u);
    expect(cover).toMatch(/large && styles\.topTabletTall/u);
  });
});

describe('the phone cover’s pill from AX1 (sc-92247)', () => {
  it('fits its name and invitation line on the shared whole-words rule, the line under the name', () => {
    const words = /function WholeOpenerWords\([\s\S]*?\n\}\n/u.exec(pill)?.[0] ?? '';
    expect(words.match(/<CappedWholeWords/gu)).toHaveLength(2);
    expect(words).toMatch(/under=\{named\}/u);
    expect(words).not.toMatch(/numberOfLines/u);
  });

  it('caps the pill under the greeting, and keeps main’s pill below AX1', () => {
    expect(cover).toMatch(/<TitleCap\.Provider value=\{greeting\}>\s+<OrgButton/u);
    expect(cover).toMatch(/const whole = large && !compact && nameRoom != null;/u);
  });
});

describe('the white pill above a phone’s Events, Calendar and Settings from AX1 (sc-92464)', () => {
  it('draws the cover’s whole-words opener on its measured row, with no line limit', () => {
    expect(cover).toMatch(/<WholeOpenerWords[\s\S]*?onDark\s+\/>/u);
    expect(frame).toMatch(/row > 0 && ends > 0 \? barePhoneNameRoom\(row, ends\) : 0/u);
    expect(frame).toMatch(
      /nameRoom=\{large && phoneRow != null \? measuredLine\(phoneRow\) : undefined\}/u,
    );
    expect(pill).toMatch(/whole\.whole \? \(\s+<WholeOpenerWords/u);
  });
});

describe('the live cover on the iPad’s side banner from AX1 (sc-92312)', () => {
  it('is drawn whole on the side banner, from the accessibility sizes', () => {
    expect(cover).toMatch(/<NowBlock moment=\{moment\} wide side \/>/u);
    expect(cover).toMatch(/const whole = useAccessibilitySizes\(\);/u);
    expect(cover).toMatch(
      /if \(side && whole && run == null && !moment\.full\) return <WholeNowBlock now=\{now\} \/>;/u,
    );
  });

  it('holds the end line, the chips and Open the event under the size the name draws', () => {
    const block = /function WholeNowBlock\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(block).toMatch(/const under = name \?\? Infinity;/u);
    expect(block).toMatch(/onDrawn=\{setName\}/u);
    expect(block.match(/under=\{under\}/gu)).toHaveLength(3);
    expect(block).toMatch(/<WholeChips now=\{now\} column=\{column\} under=\{under\} \/>/u);
    expect(block).toMatch(/<WholeWhiteButton[\s\S]*?under=\{under\}/u);

    const chips = /export function WholeChips\([\s\S]*?\n\}\n/u.exec(run)?.[0] ?? '';
    expect(chips.match(/under=\{under\}/gu)).toHaveLength(2);
    const button = /export function WholeWhiteButton\([\s\S]*?\n\}\n/u.exec(run)?.[0] ?? '';
    expect(button.match(/under=\{under\}/gu)).toHaveLength(1);
  });
});
