#!/usr/bin/env node
// The every-three-minutes check behind a role's routine: .claude/skills/role-routine.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOT_TRANSLATION = '!label:translation';
const TRANSLATION_QUEUE = ['To Do', 'In Progress', 'Failed QA'];
const linguist = (locale, heartbeat, sweeps = false) => ({
  skill: 'soirely-linguist',
  invoke: `/soirely-linguist ${locale}`,
  queue: TRANSLATION_QUEUE,
  filter: 'label:translation',
  heartbeat,
  sweeps,
});

export const ROLES = {
  pm: {
    skill: 'soirely-product-manager',
    queue: ['To Do', 'Failed QA'],
    filter: NOT_TRANSLATION,
    heartbeat: 120,
    sweeps: true,
  },
  ux: {
    skill: 'soirely-designer',
    queue: ['To Do', 'Failed QA'],
    filter: NOT_TRANSLATION,
    heartbeat: 120,
    sweeps: true,
  },
  dev: {
    skill: 'soirely-developer',
    queue: ['Failed QA', 'In Progress', 'To Do'],
    filter: NOT_TRANSLATION,
    heartbeat: 30,
    prs: true,
  },
  qa: { skill: 'soirely-qa-tester', queue: ['Ready For QA'], heartbeat: 30 },
  lead: { skill: 'soirely-tech-lead', queue: ['In Review'], heartbeat: 30 },
  bm: {
    skill: 'soirely-business-manager',
    queue: ['Backlog', 'To Do'],
    filter: NOT_TRANSLATION,
    heartbeat: 720,
    sweeps: true,
  },
  ops: { skill: 'soirely-ops', queue: [], heartbeat: 360, sweeps: true, main: true },
  en: linguist('en', 120, true),
  es: linguist('es', 30),
  fr: linguist('fr', 30),
  pt: linguist('pt', 30),
  cd: { skill: 'soirely-creative', queue: [], heartbeat: 1440, sweeps: true },
};

export function queueQuery(role, state) {
  return [`state:"${state}"`, ROLES[role].filter].filter(Boolean).join(' ');
}

const API = 'https://api.app.shortcut.com';
const INBOX_DAYS = 14;
const BUSY_LIMIT_MINUTES = 180;
const MINUTE = 60_000;

export function header(text) {
  const first = String(text ?? '').split('\n', 1)[0];
  const match = /^\s*((?:\[[a-z]+\]\s*)+)\(from ([a-z]+)\)/.exec(first);
  if (!match) return null;
  return { to: [...match[1].matchAll(/\[([a-z]+)\]/g)].map((m) => m[1]), from: match[2] };
}

export function inboxFor(role, stories) {
  const items = [];
  for (const story of stories) {
    for (const comment of story.comments ?? []) {
      if (comment.deleted) continue;
      const parsed = header(comment.text);
      if (parsed && parsed.to.includes(role) && parsed.from !== role) {
        items.push(`${story.id}#${comment.id}`);
      }
    }
  }
  return items;
}

export function decide({ role, previous, snapshot, now }) {
  const config = ROLES[role];
  if (previous.running && now - previous.running < BUSY_LIMIT_MINUTES * MINUTE) {
    return { verdict: 'busy', state: previous };
  }

  const seen = new Set(previous.seen ?? []);
  const reasons = [];
  const added = (list, label) => {
    const fresh = list.filter((item) => !seen.has(item));
    if (fresh.length) reasons.push(`${label} ${fresh.join(', ')}`);
  };
  added(snapshot.inbox ?? [], 'inbox');
  added(snapshot.queue ?? [], 'queue');
  added(snapshot.prs ?? [], 'pull requests');
  added(snapshot.main ?? [], 'main');

  const idleFor = now - (previous.woke ?? 0);
  const hasWork = config.sweeps || (snapshot.queue ?? []).length > 0 || !snapshot.shortcut;
  if (!reasons.length && hasWork && idleFor >= config.heartbeat * MINUTE) {
    reasons.push(`heartbeat, ${Math.round(idleFor / MINUTE)} minutes since the last run`);
  }

  const current = [snapshot.inbox, snapshot.queue, snapshot.prs, snapshot.main]
    .flat()
    .filter(Boolean);
  if (!reasons.length) return { verdict: 'idle', state: { ...previous, seen: current } };
  return {
    verdict: 'wake',
    reasons,
    state: { ...previous, seen: current, woke: now, running: now },
  };
}

export function brief(role, reasons, script) {
  const { skill, invoke = `/${skill}` } = ROLES[role];
  return [
    `Run \`${invoke}\` as an unattended routine run (.claude/skills/role-routine, section 3).`,
    `Why this run woke: ${reasons.join('; ')}.`,
    'Start with those, then the skill’s usual order. Nobody is watching: never wait for an answer.',
    `As your last step run \`node ${script} ${role} --done\`, adding \`--more\` if work you could do now is still waiting.`,
    'Then report in at most ten lines.',
  ].join('\n');
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

async function shortcut(path, token) {
  const response = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    headers: { 'Shortcut-Token': token, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Shortcut ${response.status} on ${path}`);
  return response.json();
}

async function search(query, token) {
  const stories = [];
  let next = `/api/v3/search/stories?detail=slim&page_size=25&query=${encodeURIComponent(query)}`;
  for (let page = 0; next && page < 10; page += 1) {
    const body = await shortcut(next, token);
    stories.push(...body.data.filter((story) => !story.archived && !story.completed));
    next = body.next;
  }
  return stories;
}

async function shortcutSnapshot(role, token, cache) {
  const config = ROLES[role];
  const queue = [];
  for (const state of config.queue) {
    for (const story of await search(queueQuery(role, state), token))
      queue.push(`sc-${story.id}:${state}`);
  }

  const since = new Date(Date.now() - INBOX_DAYS * 24 * 60 * MINUTE).toISOString().slice(0, 10);
  const recent = await search(`updated:${since}..*`, token);
  const stories = {};
  for (const story of recent) {
    const cached = cache[story.id];
    stories[story.id] =
      cached?.updated_at === story.updated_at
        ? cached
        : {
            updated_at: story.updated_at,
            ...pick(await shortcut(`/api/v3/stories/${story.id}`, token)),
          };
  }
  const inbox = inboxFor(
    role,
    Object.entries(stories).map(([id, story]) => ({ id, ...story })),
  );
  return { queue, inbox, stories };
}

function pick(story) {
  return { comments: story.comments.map(({ id, text, deleted }) => ({ id, text, deleted })) };
}

function githubSnapshot(role) {
  const config = ROLES[role];
  const snapshot = {};
  if (config.prs) {
    const prs = JSON.parse(
      capture('gh', [
        'pr',
        'list',
        '--state',
        'open',
        '--json',
        'number,headRefOid,statusCheckRollup',
      ]),
    );
    snapshot.prs = prs
      .map((pr) => `#${pr.number}@${pr.headRefOid.slice(0, 7)}:${rollup(pr.statusCheckRollup)}`)
      .filter((pr) => !pr.endsWith(':pending'));
  }
  if (config.main) {
    const [run] = JSON.parse(
      capture('gh', [
        'run',
        'list',
        '--branch',
        'main',
        '--limit',
        '1',
        '--json',
        'headSha,conclusion',
      ]),
    );
    if (run && run.conclusion && run.conclusion !== 'success')
      snapshot.main = [`${run.headSha.slice(0, 7)}:${run.conclusion}`];
  }
  return snapshot;
}

export function rollup(checks = []) {
  const states = checks.map((check) =>
    (check.conclusion || check.state || check.status || '').toUpperCase(),
  );
  if (
    states.some((state) =>
      ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(state),
    )
  )
    return 'red';
  if (states.some((state) => ['', 'PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'].includes(state)))
    return 'pending';
  return 'green';
}

function home() {
  const dir = resolve(capture('git', ['rev-parse', '--git-common-dir']), 'soirely-roles');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function load(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

// Every role's session shares stories.json, so a write lands whole or not at all.
function save(path, value) {
  writeFileSync(`${path}.${process.pid}`, JSON.stringify(value));
  renameSync(`${path}.${process.pid}`, path);
}

async function main([role, flag, more]) {
  if (!ROLES[role]) {
    console.error(
      `usage: role-tick.mjs <${Object.keys(ROLES).join('|')}> [--install|--done [--more]]`,
    );
    process.exit(2);
  }
  const dir = home();
  const script = join(dir, 'role-tick.mjs');
  const statePath = join(dir, `${role}.json`);
  const cachePath = join(dir, 'stories.json');
  const previous = load(statePath);

  if (flag === '--done') {
    // --more lets the next tick wake at once, rather than a heartbeat later.
    save(statePath, { ...previous, running: null, ...(more === '--more' && { woke: 0 }) });
    return console.log('done');
  }

  const token = process.env.SHORTCUT_API_TOKEN;
  const cache = load(cachePath);
  const fromShortcut = token ? await shortcutSnapshot(role, token, cache) : {};
  const snapshot = { ...fromShortcut, ...githubSnapshot(role), shortcut: Boolean(token) };
  if (fromShortcut.stories) save(cachePath, fromShortcut.stories);

  if (flag === '--install') {
    copyFileSync(fileURLToPath(import.meta.url), script);
    const seen = [snapshot.inbox, snapshot.queue, snapshot.prs, snapshot.main]
      .flat()
      .filter(Boolean);
    save(statePath, { seen, woke: Date.now(), running: null });
    return console.log(
      token
        ? `installed ${script}`
        : `installed ${script}; no SHORTCUT_API_TOKEN, so Shortcut is not checked`,
    );
  }

  const { verdict, reasons, state } = decide({ role, previous, snapshot, now: Date.now() });
  save(statePath, state);
  if (verdict !== 'wake') return console.log(verdict);
  console.log(`wake: ${reasons.join('; ')}\n---\n${brief(role, reasons, script)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.log(`error: ${error.message}`);
    process.exit(1);
  });
}
