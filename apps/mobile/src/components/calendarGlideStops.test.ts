import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const board = readFileSync(join('src', 'components', 'CalendarBoard.tsx'), 'utf8');
const glideAt = board.indexOf('function useGlide(');
const glide = board.slice(glideAt, board.indexOf('export interface', glideAt));
const scrollWeeks = board.slice(
  board.indexOf('const scrollWeeks = '),
  board.indexOf('const scrollAgenda = '),
);

describe('a glide the next one stops leaves the next one its span (sc-83008)', () => {
  it('calls done only from a glide that finished, since stop() ends the old one at once', () => {
    expect(glide).toMatch(
      /running\.current\.start\(\(\{ finished \}\) => \{\s+value\.removeListener\(heard\);\s+if \(finished\) done\(\);/u,
    );
    expect(glide).not.toMatch(/start\(\(\) =>/u);
  });

  it('stops the running glide before anything of the next one is applied', () => {
    expect(glide.indexOf('running.current?.stop();')).toBeLessThan(glide.indexOf('apply(to);'));
  });

  it('opens the new span before the glide, and closes it only from its own done', () => {
    expect(scrollWeeks).toMatch(
      /weekAsked\.current = \{ from: weekY\.current, to \};\s+glide\(weekY\.current, to, toWeekY, \(\) => \{\s+weekAsked\.current = \{ from: to, to \};/u,
    );
  });
});
