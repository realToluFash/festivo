import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'FloorScreen.tsx'), 'utf8');

describe('an unnamed dish inside a sentence on the app’s Floor (sc-4021)', () => {
  it('takes the in-sentence words, joined as the locale lists them', () => {
    expect(screen).toMatch(
      /function itemsInSentence\(.*\n\s*return listFormat\(dateLocale\(\), \{ type: 'conjunction' \}\)\.format\(\n.*t\('service\.floor\.chefsChoiceInSentence'\)/u,
    );
  });

  it('is lowercased in the Send back sheet’s title and in the Sent back step', () => {
    expect(screen).toMatch(
      /t\('service\.floor\.sendBackTitle', \{ items: itemsInSentence\(sending\.plate, t\) \}\)/u,
    );
    expect(screen).toMatch(
      /t\('service\.floor\.step\.sentBack', \{[^}]*items: itemsInSentence\(sending\.plate, t\),/u,
    );
  });
});
