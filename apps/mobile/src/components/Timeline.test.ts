import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const timeline = readFileSync(join('src', 'components', 'Timeline.tsx'), 'utf8');

function rowSource(): string {
  const start = timeline.indexOf('function MilestoneRow(');
  const end = timeline.indexOf('\nfunction ', start + 1);

  return timeline.slice(start, end);
}

describe('a Coming up or All dates row’s date (sc-30413)', () => {
  it('is the milestone’s moment, with its year when that is not this year by the row’s clock', () => {
    const row = rowSource();

    expect(row).toMatch(/\{\s+marked,\s+timeZone,\s+now,/u);
    expect(row).toMatch(
      /const moment = milestoneMoment\(milestone\.at, timeZone, now, dateLocale\(\)\);/u,
    );
    expect(row).not.toMatch(/formatEventMoment\(/u);
  });
});
