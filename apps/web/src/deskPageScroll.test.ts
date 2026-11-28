import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STYLES } from './test-styles.ts';

const WEB_SRC = import.meta.dirname;

function rulesSettingOverflowOnDeskPage(): string[] {
  return readdirSync(WEB_SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.css') && !file.startsWith('demo/'))
    .flatMap((file) =>
      [
        ...readFileSync(join(WEB_SRC, file), 'utf8')
          .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
          .matchAll(/([^{};]+)\{([^{}]*)\}/gu),
      ]
        .map(([, selector = '', body = '']) => ({ selector: selector.trim(), body }))
        .filter(({ selector, body }) => /\.desk-page\b/u.test(selector) && /overflow/u.test(body))
        .map(({ selector }) => `${file}: ${selector}`),
    )
    .sort();
}

describe('a desk page in the signed-in shell (sc-98499)', () => {
  it('never scrolls itself at any width: one shell rule, outside every media query', () => {
    expect(STYLES).toContain('\n.shell-content .desk-page {\n  overflow: visible;\n}\n');
  });

  it('is left to that rule by every page that borrows it; outside the shell Settings’ own scroll stands', () => {
    expect(rulesSettingOverflowOnDeskPage()).toEqual([
      'components/SettingsParts.css: .desk-page',
      'styles.css: .shell-content .desk-page',
    ]);
  });
});
