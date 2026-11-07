#!/usr/bin/env node
/** Fails on a Mercure topic written by hand: a client builds every topic with realtimeTopic(). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GENERATED = 'packages/api-client/src/topics.ts';
/** The copy and the two tests that prove it is generated right. */
const EXEMPT = [
  GENERATED,
  'packages/api-client/src/topics.test.ts',
  'packages/api-client/scripts/generate-topics.test.mjs',
];
const ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/mobile/app', 'packages'];
const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;

/** The templates the generated copy declares, as written there. */
export function declaredTemplates(generated) {
  return [...generated.matchAll(/^ {2}\w+: '([^']+)',$/gm)].map(([, template]) => template);
}

/** A pattern for each template matching it written with any id, a literal or an interpolation. */
export function patternFor(template) {
  const literal = template.split('{id}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(literal.join('[^\'"`\\s]+'));
}

/** @param {Array<{ path: string, contents: string }>} files */
export function strayTopics(templates, files) {
  const patterns = templates.map(patternFor);

  return files.flatMap(({ path, contents }) =>
    contents
      .split('\n')
      .flatMap((line, index) =>
        patterns.some((pattern) => pattern.test(line))
          ? [`${path}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules') return [];
    if (statSync(path).isDirectory()) return sources(path);

    return SOURCE.test(name) ? [path] : [];
  });
}

if (process.argv[1] != null && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const templates = declaredTemplates(readFileSync(GENERATED, 'utf8'));
  const files = ROOTS.flatMap(sources)
    .map((path) => relative('.', path))
    .filter((path) => !EXEMPT.includes(path))
    .map((path) => ({ path, contents: readFileSync(path, 'utf8') }));
  const stray = strayTopics(templates, files);

  if (stray.length > 0) {
    console.error(
      'A topic written by hand. Build it with realtimeTopic() from @soirely/api-client:\n',
    );
    console.error(stray.join('\n'));
    process.exit(1);
  }

  console.log(`No topic written outside ${GENERATED}.`);
}
