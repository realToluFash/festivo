import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const primary = readFileSync(join('src', 'components', 'TopPrimary.tsx'), 'utf8');
const exporting = readFileSync(join('src', 'components', 'GuestExport.tsx'), 'utf8');

describe('the title row’s pills at the largest text sizes (sc-67659)', () => {
  it('grows the labelled primary, + Add guest and + New event, to hold its words', () => {
    expect(primary).toMatch(
      /glyph="plus"\s+height=\{tokens\.sizeHit\}\s+full=\{false\}\s+grows\s/u,
    );
  });

  it('chooses the words or the round + from the growing pill it draws, measured on one line', () => {
    expect(primary).toMatch(
      /<Pill label=\{label\} glyph="plus" height=\{tokens\.sizeHit\} full=\{false\} grows \/>/u,
    );
    expect(primary).toMatch(/measure: \{[^}]*width: 10000,/u);
  });

  it('grows Export to hold its word', () => {
    expect(exporting).toMatch(
      /kind="secondary"\s+height=\{tokens\.sizeHit\}\s+full=\{false\}\s+grows\s/u,
    );
  });

  it('draws Export’s offline words whole, under the title’s cap', () => {
    expect(exporting).toMatch(
      /<CappedWholeWords\s+size=\{13\.5\}[^>]*>\s+\{t\('guestExport\.needsConnection'\)\}/u,
    );
  });
});

describe('Export’s title at the largest text sizes (sc-72136)', () => {
  it('draws the title as a Title given the row’s room, reporting the size it drew', () => {
    expect(exporting).toMatch(
      /<Title\s+size=\{TITLE\}[^<]*\sroom=\{room > 0 [^<]*\sonDrawn=\{onDrawn\}\s*>\s+\{title\}\s+<\/Title>/u,
    );
  });

  it('puts Cancel under the title by the shared rule', () => {
    expect(exporting).toMatch(/import \{ cancelUnder \} from '\.\.\/layout\/titleFit\.ts';/u);
    expect(exporting).toMatch(/const under = cancelUnder\(/u);
  });

  it('caps the sheet’s and the panel’s body at the title’s drawn size', () => {
    expect(exporting.match(/<TitleCap\.Provider value=\{drawn\}>/gu)).toHaveLength(2);
    expect(exporting.match(/onDrawn=\{setDrawn\}/gu)).toHaveLength(2);
  });

  it('scrolls the note and Share with the body in the sheet and the panel', () => {
    expect(
      exporting.match(/\{scrolls && <View style=\{styles\.footScrolled\}>\{foot\}<\/View>\}/gu),
    ).toHaveLength(2);
  });
});
