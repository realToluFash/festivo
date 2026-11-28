import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

describe('Replace it? takes TalkBack’s focus on its question (sc-82665)', () => {
  it('hangs the amber panel’s ref on its title, the stop TalkBack reads, not on the panel', () => {
    const amber = read('Amber.tsx');

    expect(amber).toContain('<View style={styles.amber}');
    expect(amber).toMatch(/<Text\s+ref=\{ref\}[^>]*accessibilityRole="header"/u);
  });

  it('moves the focus there, with the title read only by that move', () => {
    const record = read('GuestRecord.tsx');

    expect(record).toContain('const replace = useRef<TextHandle>(null);');
    expect(record).toMatch(/<Amber\s+ref=\{replace\}/u);
    expect(record).toContain('readsTitle={false}');
    expect(record.match(/focus\(replace\);/gu)).toHaveLength(2);
  });
});
