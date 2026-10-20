#!/usr/bin/env node
// What the linguists have left to do: .claude/skills/soirely-linguist, section 4.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCALES = ['en', 'es', 'fr', 'pt'];

export const CATALOGUES = {
  web: 'apps/web/src/i18n/locales/{locale}.json',
  mobile: 'apps/mobile/src/i18n/locales/{locale}.json',
  messages: 'services/api/translations/messages.{locale}.json',
  errors: 'services/api/translations/errors.{locale}.json',
  emails: 'services/api/translations/emails.{locale}.json',
  emailCounts: 'services/api/translations/emails+intl-icu.{locale}.json',
};

const SAME_AS_ENGLISH = 'docs/i18n/same-as-english.json';

export function flatten(tree, prefix = '') {
  return Object.entries(tree).reduce((flat, [key, value]) => {
    const path = `${prefix}${key}`;
    return value !== null && typeof value === 'object'
      ? { ...flat, ...flatten(value, `${path}.`) }
      : { ...flat, [path]: value };
  }, {});
}

function hasWords(text) {
  return /\p{L}{2}/u.test(String(text).replace(/\{\{[^}]*\}\}|\{[^}]*\}|%[^%\s]+%|<[^>]*>/g, ''));
}

export function untranslated(english, other, allowed = []) {
  const missing = Object.keys(english).filter((key) => !(key in other));
  const same = Object.keys(english).filter(
    (key) => other[key] === english[key] && hasWords(english[key]) && !allowed.includes(key),
  );
  return { missing, same };
}

// A key is stale in a locale when its English changed since `since` and its own text did not.
export function changedSince(englishBefore, englishNow, otherBefore, otherNow) {
  const changed = Object.keys(englishNow).filter((key) => englishBefore[key] !== englishNow[key]);
  return {
    changed,
    stale: changed.filter((key) => key in englishBefore && otherBefore[key] === otherNow[key]),
  };
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

function catalogue(name, locale, ref) {
  const path = CATALOGUES[name].replace('{locale}', locale);
  const text = ref ? git(['show', `${ref}:${path}`]) : readFileSync(path, 'utf8');
  return text ? flatten(JSON.parse(text)) : {};
}

function report(locale, since) {
  const allowed = JSON.parse(readFileSync(SAME_AS_ENGLISH, 'utf8'))[locale] ?? [];
  const lines = [];
  for (const name of Object.keys(CATALOGUES)) {
    const english = catalogue(name, 'en');
    const key = (k) => `${name}:${k}`;
    if (since) {
      const before = catalogue(name, 'en', since);
      const { changed, stale } =
        locale === 'en'
          ? changedSince(before, english, {}, {})
          : changedSince(before, english, catalogue(name, locale, since), catalogue(name, locale));
      const list = locale === 'en' ? changed : stale;
      lines.push(
        ...list.map(
          (k) =>
            `${locale === 'en' ? 'changed' : 'stale'}  ${key(k)}  ${JSON.stringify(english[k])}`,
        ),
      );
    }
    if (locale === 'en') continue;
    const { missing, same } = untranslated(
      english,
      catalogue(name, locale),
      allowed.filter((k) => k.startsWith(`${name}:`)).map((k) => k.slice(name.length + 1)),
    );
    lines.push(...missing.map((k) => `missing  ${key(k)}  ${JSON.stringify(english[k])}`));
    lines.push(...same.map((k) => `english  ${key(k)}  ${JSON.stringify(english[k])}`));
  }
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [locale, flag, since] = process.argv.slice(2);
  if (!LOCALES.includes(locale) || (flag && flag !== '--since') || (flag && !since)) {
    console.error(`usage: locale-status.mjs <${LOCALES.join('|')}> [--since <ref>]`);
    process.exit(2);
  }
  const lines = report(locale, since);
  console.log(lines.length ? lines.join('\n') : `${locale}: nothing to translate`);
}
