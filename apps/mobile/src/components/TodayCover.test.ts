import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { clearOfWords, pieceBounds, piecesClearOf, type Piece } from '../kit/confettiClearance.ts';

const cover = readFileSync(join('src', 'components', 'TodayCover.tsx'), 'utf8');
const frame = readFileSync(join('src', 'components', 'AppFrame.tsx'), 'utf8');
const tabLabel = readFileSync(join('src', 'layout', 'tabLabel.ts'), 'utf8');
const title = readFileSync(join('src', 'components', 'Title.tsx'), 'utf8');
const pill = readFileSync(join('src', 'components', 'OrgPill.tsx'), 'utf8');
const run = readFileSync(join('src', 'components', 'TodayRun.tsx'), 'utf8');
const listTop = readFileSync(join('src', 'components', 'ListTop.tsx'), 'utf8');
const today = readFileSync(join('src', 'components', 'TodayScreen.tsx'), 'utf8');

describe('the tab bar’s labels at twice the text size (sc-37298)', () => {
  it('measures each label whole in SemiBold, capped at 20', () => {
    expect(tabLabel).toMatch(/export const TAB_LABEL = 12;/u);
    expect(tabLabel).toMatch(/export const TAB_LABEL_MOST = 20;/u);
  });

  it('keeps that floor everywhere but the event’s bar (sc-71148)', () => {
    expect(cover).toMatch(
      /stepsBelowDefault\s+\? eventBarLabelSize\(fontScale, widest, slot\)\s+: fitWidest\(TAB_LABEL, start, widest, slot\);/u,
    );
    expect(frame.match(/stepsBelowDefault/gu)).toHaveLength(1);
  });
});

describe('the phone’s tab bars (sc-71148, sc-99214)', () => {
  it('measures every word in SemiBold at the start and draws all labels at exactly the size that fits', () => {
    const measuredAt = /export function useMeasuredAt\([\s\S]*?\n\}\n/u.exec(title)?.[0] ?? '';
    expect(measuredAt).toMatch(
      /<MeasuredWords\s+words=\{words\}\s+size=\{start\}\s+weight=\{weight\}\s+allowFontScaling=\{false\}/u,
    );
    expect(measuredAt).toMatch(/weight: 'regular' \| 'semibold' = 'semibold'/u);
    expect(cover).toMatch(/size=\{size\}\s+allowFontScaling=\{false\}/u);
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

describe('the upright capsule at the largest sizes (sc-92571)', () => {
  it('grows with its labels, and the top row keeps room for it', () => {
    const capsule = /export function TabCapsule\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(capsule).toMatch(/<Glass height=\{CAPSULE_HEIGHT\} grows /u);
    expect(capsule).toMatch(/\s+wholeLines\s/u);
    const tab = / {2}capsuleTab: \{[\s\S]*?\n {2}\},/u.exec(cover)?.[0] ?? '';
    expect(tab).toMatch(/minHeight: CAPSULE_HEIGHT - 2 \* tokens\.spaceXxs,/u);
    expect(tab).not.toMatch(/\bheight:/u);
    expect(cover).toMatch(/capsule > CAPSULE_HEIGHT && \{ minHeight: CAPSULE_TOP \+ capsule \}/u);
  });
});

describe('the band’s capsule at the largest sizes (sc-92571)', () => {
  it('keeps the live line below the grown capsule', () => {
    const band = /export function Band\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(band).toMatch(/tall && \{ minHeight: CAPSULE_TOP \+ capsule \}/u);
    expect(band).toMatch(
      /onLayout=\{\(event\) => setCapsule\(event\.nativeEvent\.layout\.height\)\}/u,
    );
    expect(band).toMatch(/\[grown \|\| tall \? 'minHeight' : 'height'\]/u);
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
    expect(frame).toMatch(/rowMeasured\(row, ends\) \? barePhoneNameRoom\(row, ends\) : 0/u);
    expect(frame).toMatch(
      /nameRoom=\{large \? wholeLine\(phoneRow, upright \? room : null\) : undefined\}/u,
    );
    expect(pill).toMatch(/whole\.whole \? \(\s+<WholeOpenerWords/u);
  });

  it('gives the pill the row’s width and the bell’s, each from its own layout', () => {
    const row = /export function PillRow\([\s\S]*?\n\}\n/u.exec(listTop)?.[0] ?? '';
    expect(row).toMatch(/onLayout=\{\(event\) => setRow\(event\.nativeEvent\.layout\.width\)\}/u);
    expect(row).toMatch(
      /<PillRowWidths\.Provider value=\{\{ row, ends \}\}>\{pill\}<\/PillRowWidths\.Provider>/u,
    );
    expect(row).toMatch(
      /<View onLayout=\{\(event\) => setEnds\(event\.nativeEvent\.layout\.width\)\}>\{bell\}<\/View>/u,
    );
    expect(frame).toMatch(/const phoneRow = usePillRowWidths\(\);/u);
  });
});

describe('the white pill over Settings beside the upright iPad’s tabs from AX1 (sc-92728)', () => {
  const portrait = /export function PortraitRow\([\s\S]*?\n\}\n/u.exec(listTop)?.[0] ?? '';

  it('gives the bare pill the room beside the tabs, 0 until they leave it some', () => {
    expect(frame).toMatch(
      /return upright === null \? undefined : bareUprightNameRoom\(upright\);/u,
    );
    expect(frame.match(/givesWay=\{givesWay\}\s+upright\s+ref=\{pill\}/gu)).toHaveLength(2);
  });

  it('keeps 8 clear of the tabs and keeps the tabs, Search and the bell to the row’s top', () => {
    expect(portrait).toMatch(
      /pillBesideTabs\(rowWidth, width, large \? tokens\.spaceSm : undefined\)/u,
    );
    expect(portrait).toMatch(/large && styles\.portraitRowTall/u);
    expect(portrait).toMatch(
      /tabsCentred \? \(large \? styles\.tabsAtTop : styles\.tabsCentred\)/u,
    );
  });
});

describe('the live cover on the iPad’s side banner from AX1 (sc-92312)', () => {
  it('is drawn whole on the side banner, from the accessibility sizes', () => {
    expect(cover).toMatch(/<NowBlock moment=\{moment\} wide side \/>/u);
    expect(cover).toMatch(/const whole = useAccessibilitySizes\(\);/u);
    expect(cover).toMatch(
      /if \(wide && whole && run == null && !moment\.full\)\n {4}return <WholeNowBlock now=\{now\} upright=\{!side\} \/>;/u,
    );
  });

  it('holds the end line, the chips and Open the event under the size the name draws', () => {
    const block = /function WholeNowBlock\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(block).toMatch(/const under = name \?\? Infinity;/u);
    expect(block).toMatch(/onDrawn=\{setName\}/u);
    expect(block.match(/under=\{under\}/gu)).toHaveLength(4);
    expect(block).toMatch(
      /\{upright \? <Chips now=\{now\} grows \/> : <WholeChips now=\{now\} column=\{column\} under=\{under\} \/>\}/u,
    );
    expect(block).toMatch(/<WholeWhiteButton[\s\S]*?under=\{under\}/u);

    const chips = /export function WholeChips\([\s\S]*?\n\}\n/u.exec(run)?.[0] ?? '';
    expect(chips.match(/under=\{under\}/gu)).toHaveLength(2);
    const button = /export function WholeWhiteButton\([\s\S]*?\n\}\n/u.exec(run)?.[0] ?? '';
    expect(button.match(/under=\{under\}/gu)).toHaveLength(1);
  });
});

describe('the live cover upright from AX1 (sc-93211)', () => {
  it('grows its chips upright, and keeps main’s chips below AX1', () => {
    expect(cover).toMatch(/<NowBlock moment=\{moment\} wide=\{!phone\} \/>/u);
  });
});

describe('the live cover on the phone from AX1 (sc-93855)', () => {
  it('grows its chips by the upright rule from AX1 and keeps main’s below it', () => {
    const below = /if \(!moment\.full\) \{[\s\S]*?\n {2}\}\n/u.exec(cover)?.[0] ?? '';
    expect(below).toMatch(/<Chips now=\{now\} grows=\{whole\} \/>/u);
    expect(cover).toMatch(/const whole = useAccessibilitySizes\(\);/u);
  });
});

describe('the live cover upright from AX1 (sc-93578)', () => {
  it('takes the whole-words block, as on its side, so Open the event sits under the end line and the name has the cover’s width', () => {
    expect(cover).toMatch(/<NowBlock moment=\{moment\} wide=\{!phone\} \/>/u);
    expect(cover).toMatch(/return <WholeNowBlock now=\{now\} upright=\{!side\} \/>;/u);

    const block = /function WholeNowBlock\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(block).toMatch(
      /<CoverLine\n {8}size=\{48\}[\s\S]*?room=\{column\}\n {8}onDrawn=\{setName\}/u,
    );
    expect(block).toMatch(/<View style=\{styles\.openUnder\}>\{open\}<\/View>/u);
    expect(block).toMatch(
      /now\.arrived != null && \(\s*<View style=\{styles\.arrivedUnder\}>\s*<WholeArrivedFigure figure=\{now\.arrived\} column=\{column\} under=\{under\} \/>\s*<\/View>\s*\)/u,
    );
  });

  it('steps the arrived figure’s numbers as one unit against the room beside the ring, under the name, and sizes the ring from what is drawn', () => {
    const figure = /function WholeArrivedFigure\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(figure).toMatch(/useWindowDimensions\(\)/u);
    expect(figure).toMatch(/labelStart\(FIGURE_NUMBERS, fontScale, under\)/u);
    expect(figure).toMatch(/words=\{\[numbers\]\}/u);
    expect(figure).toMatch(/fitWidest\(FIGURE_NUMBERS, start, width, Math\.max\(room, 1\)\)/u);
    expect(figure).toMatch(/figureRing\(drawn, /u);
    expect(figure).toMatch(/<CoverLine[\s\S]*?under=\{drawn\}/u);
    expect(figure).not.toMatch(/PixelRatio/u);
  });

  it('draws the chips’ words at main’s 13, never stepped down and never cut to one line', () => {
    const chips = /export function Chips\([\s\S]*?\n\}\n/u.exec(run)?.[0] ?? '';
    const grown = /\{grows \? \(([\s\S]*?)\) : \(/u.exec(chips)?.[1] ?? '';
    expect(grown).toMatch(/size=\{13\} weight="semibold" wholeLines/u);
    expect(grown).toMatch(/\{dotKept\(now\.live\)\}/u);
    expect(grown).not.toMatch(/numberOfLines|maxFontSizeMultiplier/u);
    expect(chips).toMatch(/grows \? styles\.chipGrows : styles\.chipFixed/u);
  });
});

describe('the phone band’s title at the largest sizes (sc-92248)', () => {
  it('fits the title between the tile and Search from AX1, and is main’s below', () => {
    const title = /function BandTitleText\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(title).toMatch(/bandTitle\(fontScale, wide, row\)/u);
    expect(title).toMatch(/numberOfLines=\{1\}/u);
    expect(title).toMatch(/lineHeight: bandLine\(drawn\)/u);
    expect(title).toMatch(/fitted == null && styles\.waiting/u);
    expect(title).toMatch(/if \(!large\) \{/u);
    const band = /export function Band\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(band).toMatch(/setTileEnd\(layout\.x \+ layout\.width\)/u);
    expect(band).toMatch(/setSearchStart\(layout\.x\)/u);
  });
});

describe('the phone band’s live line under the title at the largest sizes (sc-92248)', () => {
  it('draws from AX1 at the size its line fits under the title’s row, hidden until the row is measured', () => {
    const band = /export function Band\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(band).toMatch(
      /bandLiveSize\(fontScale, bandLiveRoom\(rowMiddle, height, LIVE_FOOT\)\)/u,
    );
    expect(band).toMatch(/allowFontScaling=\{!underTitle\}/u);
    expect(band).toMatch(/lineHeight: liveLineHeight\(liveSize\)/u);
    expect(band).toMatch(/underTitle && liveSize == null && styles\.waiting/u);
  });
});

describe('the phone band’s confetti clear of the title at the largest sizes (sc-92248)', () => {
  it('from AX1 draws only the pieces 8 clear of the title, and none until the title is measured at its fitted size', () => {
    const band = /export function Band\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(band).toMatch(
      /words=\{underTitle \? \(titleOnBand == null \? null : \[titleOnBand\]\) : undefined\}/u,
    );
    expect(band).toMatch(/y: rowAt\.y - top \+ titleBox\.y/u);
    expect(band).toMatch(/onTitle=\{setTitleBox\}/u);

    const text = /function BandTitleText\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(text).toMatch(/const ready = large && fitted != null && text\?\.size === drawn;/u);
    expect(text).toMatch(/setText\(\{ size: drawn, box: layout \}\)/u);
  });
});

describe('the phone band’s pieces against a French title at AX1 (sc-92248)', () => {
  const literal =
    /const BAND_PIECES: readonly Piece\[\] = (\[[\s\S]*?\]);\n/u.exec(cover)?.[1] ?? '[]';
  const pieces = JSON.parse(literal.replaceAll("'", '"').replace(/,\s*\]$/u, ']')) as Piece[];
  const band = { width: 402, height: 56 };
  const aujourdhui = { x: 116, y: 2, width: 170, height: 44 };

  it('leaves out the sun and white pieces within 8 of the title, and keeps the rose', () => {
    expect(piecesClearOf(pieces, band, 1, [aujourdhui]).map((piece) => piece[5])).toEqual(['rose']);
  });

  it('draws no piece within 8 of the title', () => {
    for (const [x, y, shape, size, turn] of piecesClearOf(pieces, band, 1, [aujourdhui]))
      expect(clearOfWords(pieceBounds({ x, y, shape, size, turn }, band, 1), aujourdhui)).toBe(
        true,
      );
  });
});

describe('Open the event on the phone’s live cover from AX1 (sc-95084)', () => {
  it('draws its words whole across the column, and main’s button below AX1', () => {
    const block = /export function NowBlock\([\s\S]*?\n\}\n/u.exec(cover)?.[0] ?? '';
    expect(block).toMatch(
      /!wide && whole \? \(\n\s*<WholeWhiteButton label=\{label\} onPress=\{onOpen\} column=\{column\}/u,
    );
    expect(block).toMatch(
      /onLayout=\{\(event\) => setColumn\(event\.nativeEvent\.layout\.width\)\}/u,
    );
  });

  it('rests the phone’s cover where the fold rules say, and the tablet’s where it always has', () => {
    expect(today).toMatch(/const places = phone \? restingPlaces\(fold\) : \[0, foldAt\];/u);
    expect(today).toMatch(
      /const wordsFrom = phone \? wordsGoFrom\(fold\) : Math\.max\(0, bandFrom - WORDS_GO\);/u,
    );
    expect(today).toMatch(/snapToOffsets=\{places\}/u);
    expect(today).toMatch(/inputRange: \[wordsFrom, bandFrom\]/u);
  });
});

describe('the end line on the phone’s live cover from AX1 (sc-96187)', () => {
  it('wraps whole across the column, stepping down only for a word too wide, and is main’s below AX1', () => {
    const below = /if \(!moment\.full\) \{[\s\S]*?\n {2}\}\n/u.exec(cover)?.[0] ?? '';
    expect(below).toMatch(
      /<CoverLine\n\s*size=\{16\}\n\s*line=\{1\.3\}\n\s*weight="semibold"\n\s*room=\{column\}\n\s*under=\{name \?\? Infinity\}\n\s*style=\{styles\.white\}\n\s*>\n\s*\{now\.ends\}/u,
    );
    expect(below).toMatch(
      /<Text size=\{16\} weight="semibold" style=\{styles\.white\}>\n\s*\{now\.ends\}/u,
    );
  });
});

describe('the name on the phone’s live cover from AX1 (sc-96733)', () => {
  it('wraps whole across the column as on the iPad, and caps the end line and Open the event at its size', () => {
    const below = /if \(!moment\.full\) \{[\s\S]*?\n {2}\}\n/u.exec(cover)?.[0] ?? '';
    expect(below).toMatch(
      /!wide && whole \? \(\n\s*<CoverLine\n\s*size=\{36\}\n\s*line=\{1\.06\}\n\s*weight="bold"\n\s*accessibilityRole="header"\n\s*room=\{column\}\n\s*onDrawn=\{setName\}[\s\S]*?\{now\.name\}\n\s*<\/CoverLine>/u,
    );
    expect(below).toMatch(/<Text\n\s*size=\{wide \? 48 : 36\}/u);
    expect(below).toMatch(
      /<WholeWhiteButton label=\{label\} onPress=\{onOpen\} column=\{column\} under=\{name \?\? Infinity\} \/>/u,
    );
  });
});

describe('the org pill’s ring where the invitation line wraps (sc-92912)', () => {
  it('hands the ring the drawn line’s height, so it sits beside the first line', () => {
    expect(pill).toMatch(
      /ringLine=\{line == null \? undefined : Math\.ceil\(line \* WAITING_LINE\)\}/u,
    );
  });

  it('aligns the row to its top once it has a ring line, and centres it before', () => {
    expect(pill).toMatch(/waitingLine: \{ flexDirection: 'row', alignItems: 'center'/u);
    expect(pill).toMatch(/waitingLineTop: \{ alignItems: 'flex-start' \}/u);
    expect(pill).toMatch(/styles\.waitingLine, ringLine != null && styles\.waitingLineTop/u);
    expect(pill).toMatch(/styles\.ringBox, \{ height: ringLine \}/u);
  });
});
