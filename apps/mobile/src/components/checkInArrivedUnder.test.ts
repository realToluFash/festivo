import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const view = readFileSync(join('src', 'components', 'CheckInView.tsx'), 'utf8');
const line = view.slice(
  view.indexOf('function DoorLine('),
  view.indexOf('\n}\n', view.indexOf('function DoorLine(')),
);

describe("Check-in's Arrived goes under a name whose widest word has no room beside it (sc-96359)", () => {
  it('measures each name word at the row title’s size, and each row and the button as drawn', () => {
    expect(view).toMatch(
      /<MeasuredWords\n\s*words=\{wordsIn\(rows\.map\(\(row\) => row\.name\)\)\}\n\s*size=\{16\}\n\s*weight="semibold"/u,
    );
    expect(view).toMatch(/row: rowWidths\[side\],\n\s*button: buttonWidth,/u);
    expect(line).toMatch(
      /<View onLayout=\{\(event\) => onRowWidth\(event\.nativeEvent\.layout\.width\)\}>/u,
    );
  });

  it('decides only for a guest not yet arrived while the door is open', () => {
    expect(view).toMatch(/under=\{\n\s*row\.arrival == null &&\n\s*open &&\n\s*arrivedUnder\(/u);
  });

  it('draws Arrived after the reply line, or after the seat and reply lines, and not at the row’s end', () => {
    expect(line).toMatch(/\) : under \? null : \(\n\s*arrivedButton\n\s*\);/u);
    expect(line).toMatch(
      /row\.seat == null \? \(\n\s*under \? \(\n\s*arrivedButton\n\s*\) : undefined/u,
    );
    expect(line).toMatch(/\{line\}\n\s*<\/Text>\n\s*\{under && arrivedButton\}/u);
  });
});
