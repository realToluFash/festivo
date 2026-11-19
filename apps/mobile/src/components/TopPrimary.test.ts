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
