import { LOCALE_CODES } from '@soirely/domain';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

/**
 * The one catalogue fact only this app knows.
 *
 * Parity, slots, plural families and empty messages are checked in
 * @soirely/i18n-lint, over every surface at once. What cannot live there is
 * this: the layouts screen resolves `layouts.${kind}` from a variable, so no
 * static check — here or there — can follow it to the three keys it needs.
 * They are asserted by name because nothing else can.
 */
const KINDS = ['phone', 'tabletPortrait', 'tabletLandscape'] as const;

it.each(LOCALE_CODES)('%s has a description for each layout kind', (locale) => {
  const catalogue = JSON.parse(
    readFileSync(join(import.meta.dirname, 'locales', `${locale}.json`), 'utf8'),
  ) as { layouts?: Record<string, unknown> };

  const missing = KINDS.filter((kind) => typeof catalogue.layouts?.[kind] !== 'string');

  expect(missing, `layouts.${missing.join(', layouts.')} missing from ${locale}`).toEqual([]);
});
