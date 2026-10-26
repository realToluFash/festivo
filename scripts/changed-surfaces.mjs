#!/usr/bin/env node
/*
 * Which surfaces a set of changed files touches.
 *
 * In Node rather than shell inside the workflow, for one reason: this is the
 * only real logic in CI, and it is the thing most likely to be quietly wrong —
 * a pattern that matches nothing means a surface silently stops being checked,
 * and the pull request still goes green. Here it is one declaration that the
 * workflow calls and a test imports, so the patterns cannot drift from what is
 * asserted about them.
 *
 * Reads newline-separated paths on stdin, writes `name=true|false` lines to
 * stdout in the shape GitHub's $GITHUB_OUTPUT wants.
 */

/**
 * Shared root configuration changes the meaning of every other job, so it runs
 * all of them. The lockfile is in there deliberately: a resolution change can
 * break a surface whose own files are untouched.
 */
export const SURFACE_PATTERNS = {
  everything:
    /^(package\.json|package-lock\.json|eslint\.config\.mjs|\.prettierrc|lefthook\.yml|compose\.yaml|locales\.json|event-states\.json|\.php-cs-fixer\.dist\.php|scripts\/|\.github\/workflows\/)/,
  api: /^services\/api\//,
  web: /^apps\/web\//,
  mobile: /^apps\/mobile\//,
  // The gateway replays the API's recorded pairs, and the domain's tests read the
  // API's own tables, so a change to either side runs the suite that compares them.
  packages:
    /^(packages\/|tools\/agent-gateway\/|services\/api\/tests\/Fixtures\/(AgentGateway|LocalTime|Venue|Address)\/|services\/api\/src\/(Domain\/Organisation\/Regions|Enum\/(DomainRefusal|EventType))\.php$)/,
  // Any catalogue anywhere, plus any client surface — a new screen can
  // introduce an untranslated literal without touching a locale file — plus
  // the lint itself, whose tests run only in that job.
  locales: /(locales\/|translations\/|^locales\.json$|^apps\/|^packages\/i18n-lint\/)/,
};

/**
 * @param {readonly string[]} files
 * @returns {Record<keyof typeof SURFACE_PATTERNS, boolean>}
 */
export function changedSurfaces(files) {
  const paths = files.map((f) => f.trim()).filter((f) => f !== '');

  return Object.fromEntries(
    Object.entries(SURFACE_PATTERNS).map(([name, pattern]) => [
      name,
      paths.some((path) => pattern.test(path)),
    ]),
  );
}

/** Everything, for when there is no usable base to diff against. */
export function allSurfaces() {
  return Object.fromEntries(Object.keys(SURFACE_PATTERNS).map((name) => [name, true]));
}

// Run as a script rather than imported.
if (process.argv[1] != null && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const stdin = await new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  const surfaces = process.argv.includes('--all')
    ? allSurfaces()
    : changedSurfaces(stdin.split('\n'));

  for (const [name, touched] of Object.entries(surfaces)) {
    process.stdout.write(`${name}=${touched}\n`);
  }
}
