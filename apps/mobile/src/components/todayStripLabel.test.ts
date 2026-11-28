import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const parts = readFileSync(join('src', 'components', 'TodayParts.tsx'), 'utf8');
const strip = parts.slice(parts.indexOf('function Strip('), parts.indexOf('function StripLabel('));
const label = parts.slice(parts.indexOf('function StripLabel('));
const labelBody = label.slice(0, label.indexOf('\n}\n'));

describe("This week's strip keeps TODAY whole at the seventh step (sc-94682)", () => {
  it('draws every day’s label through StripLabel', () => {
    expect(strip).toContain('<StripLabel');
  });

  it('steps the label down to fit its column', () => {
    expect(labelBody).toMatch(/fitWidest\(TYPE\.label, start, /u);
  });

  it('keeps the step’s whole line as the label’s room, so today’s circle stays in line', () => {
    expect(labelBody).toContain('{ minHeight: wholeLineHeight(start, start) }');
  });
});
