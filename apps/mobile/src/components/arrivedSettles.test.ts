import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const skeleton = readFileSync(join('src', 'components', 'Skeleton.tsx'), 'utf8');
const arrived = skeleton.slice(
  skeleton.indexOf('export function Arrived('),
  skeleton.indexOf('function usePulse('),
);

describe('Arrived lets go of its fade only once it has reached 1 (sc-48600)', () => {
  it('settles from a run that finished, never from one that was stopped', () => {
    expect(arrived).toMatch(
      /run\.start\(\(\{ finished \}\) => \{\s+if \(finished\) setSettled\(true\);/u,
    );
    expect(arrived).not.toContain('run.start(() => setSettled(true));');
  });

  it('keeps the opacity bound until it has settled, whatever the motion setting', () => {
    expect(arrived).toContain('!settled && { opacity: shown }');
    expect(arrived).not.toMatch(/reduced \|\| settled/u);
  });

  it('carries less motion to 1 through a run of its own, so reduced turning on mid-fade still ends at 1', () => {
    expect(arrived).toContain('duration: reduced ? 0 : tokens.motionBase,');
    expect(arrived).toContain('}, [settled, reduced, shown]);');
    expect(arrived).not.toMatch(/shown\.setValue\(1\)/u);
  });
});
