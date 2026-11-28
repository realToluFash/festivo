import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (...path: string[]) => readFileSync(join(...path), 'utf8');
const redeem = read('src', 'components', 'Redeem.tsx');
const route = read('app', 'd', 'index.tsx');
const locales = ['en', 'es', 'fr', 'pt'].map(
  (locale) =>
    JSON.parse(read('src', 'i18n', 'locales', `${locale}.json`)) as {
      redeem: { signedOut: string };
    },
);

describe('Sign out lands on an empty Enter a door code that says Signed out. (sc-4235)', () => {
  it('leaves "You’re in for…" for the first step, nothing filled in', () => {
    expect(redeem).toMatch(
      /setAccount\(null\);\s*go\(\{ kind: 'enter', typed: '', line: null, busy: false, signedOut: true \}\);/u,
    );
  });

  it('says Signed out. above the heading, read out without focus moving, until the next step', () => {
    expect(redeem).toMatch(
      /\{step\.signedOut === true && <SignedOutLine \/>\}\s*<Heading title=\{t\('redeem\.enterTitle'\)\} \/>/u,
    );
    expect(redeem).toMatch(/const words = t\('redeem\.signedOut'\);\s*useReadOut\(words\);/u);
    expect(redeem).toMatch(/busy: true, signedOut: false \}\)/u);
  });

  it('opens signed out from Sign out elsewhere in the app, by its link', () => {
    expect(route).toMatch(/<Redeem code="" signedOut=\{signedOut === '1'\} \/>/u);
  });

  it('uses the browser’s words in every locale', () => {
    expect(locales.map((locale) => locale.redeem.signedOut)).toEqual([
      'Signed out.',
      'Sesión cerrada.',
      'Session fermée.',
      'Sessão encerrada.',
    ]);
  });
});
