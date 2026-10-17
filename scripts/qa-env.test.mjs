import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  branchForStory,
  COMPOSE_PROJECT,
  parseTarget,
  QA_OVERRIDES,
  QA_PORTS,
  qaConfig,
  renderQaEnv,
  TESTERS,
  testerOf,
} from './qa-env.mjs';

// A port left at its development default is two stacks fighting over it, and a
// missing project name is the QA reset dropping the developer's database.
describe('the QA .env', () => {
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  const rendered = renderQaEnv(example);
  const values = Object.fromEntries(
    rendered
      .split('\n')
      .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line))
      .filter((match) => match !== null)
      .map(([, key, value]) => [key, value]),
  );

  it('names its own compose project', () => {
    expect(values.COMPOSE_PROJECT_NAME).toBe(COMPOSE_PROJECT);
  });

  it('moves every port the example publishes', () => {
    const examplePorts = [...example.matchAll(/^([A-Z_]+_PORT)=/gm)].map(([, key]) => key);

    expect(examplePorts.length).toBeGreaterThan(5);
    for (const key of examplePorts) {
      expect(QA_PORTS, `${key} has no QA port`).toHaveProperty(key);
      expect(values[key]).toBe(String(QA_PORTS[key]));
    }
  });

  it('points nothing a browser reaches at a development port', () => {
    const developmentPorts = [...example.matchAll(/^[A-Z_]+_PORT=(\d+)/gm)].map(([, p]) => p);

    for (const [key, value] of Object.entries(values)) {
      if (
        !/^https?:\/\//.test(value) ||
        /^https?:\/\/(postgres|redis|mercure|storage|mailpit|smocker)\b/.test(value)
      )
        continue;
      for (const port of developmentPorts) {
        expect(value, key).not.toMatch(new RegExp(`:${port}\\b`));
      }
      expect(value, key).not.toContain('localhost');
    }
  });

  it('keeps everything the example declares, once', () => {
    for (const [, key] of example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) {
      expect(rendered.match(new RegExp(`^${key}=`, 'gm')), key).toHaveLength(1);
    }
  });

  it('appends an override the example does not declare', () => {
    expect(renderQaEnv('API_PORT=8080\n', { API_PORT: 1, NEW_THING: 'x' })).toMatch(
      /^API_PORT=1$[\s\S]*^NEW_THING=x$/m,
    );
  });

  it('carries every override', () => {
    for (const [key, value] of Object.entries(QA_OVERRIDES)) {
      expect(values[key], key).toBe(String(value));
    }
  });
});

describe('what checkout was asked for', () => {
  it.each([
    ['36', { kind: 'pr', number: 36 }],
    ['#36', { kind: 'pr', number: 36 }],
    ['sc-55', { kind: 'story', id: 'sc-55' }],
    ['SC-55', { kind: 'story', id: 'sc-55' }],
    ['feature/sc-55/sign-in', { kind: 'branch', name: 'feature/sc-55/sign-in' }],
    ['origin/main', { kind: 'branch', name: 'main' }],
    [undefined, { kind: 'branch', name: 'main' }],
  ])('%s', (arg, expected) => {
    expect(parseTarget(arg)).toEqual(expected);
  });
});

describe('the branch for a story', () => {
  const remote = [
    '  origin/HEAD -> origin/main',
    '  origin/main',
    '  origin/feature/sc-55/sign-in',
    '  origin/fix/sc-550/other',
    '  origin/feature/sc-56/devices',
    '  origin/fix/sc-56/failed-qa',
  ];

  it('is the one naming it as a segment, not as a prefix of a longer id', () => {
    expect(branchForStory('sc-55', remote)).toBe('feature/sc-55/sign-in');
  });

  it('is a question when two branches name it', () => {
    expect(() => branchForStory('sc-56', remote)).toThrow(/several/);
  });

  it('is an error when none does', () => {
    expect(() => branchForStory('sc-99', remote)).toThrow(/no remote branch/);
  });
});

// Three testers run at once. A port two stacks share is one tester's stack failing to
// start, and a shared project name is one tester's reset dropping another's database.
describe('the three QA testers', () => {
  const configs = TESTERS.map((tester) => qaConfig(tester));

  it('are tester 1 exactly as before', () => {
    expect(configs[0].project).toBe('soirely-qa');
    expect(configs[0].ports.API_PORT).toBe(18080);
    expect(configs[0].simulators.phone.name).toBe('Soirely QA iPhone');
  });

  it('each have their own project, simulators and Chrome', () => {
    for (const key of ['project', 'chromePort']) {
      expect(new Set(configs.map((c) => c[key])).size, key).toBe(TESTERS.length);
    }
    const names = configs.flatMap((c) => Object.values(c.simulators).map((s) => s.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('share no port with each other or with development', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const development = [...example.matchAll(/^[A-Z_]+_PORT=(\d+)/gm)].map(([, p]) => Number(p));
    const all = [...development, ...configs.flatMap((c) => Object.values(c.ports))];
    expect(new Set(all).size).toBe(all.length);
    expect(Math.max(...all)).toBeLessThan(65536);
  });

  it('render a .env naming their own project', () => {
    const rendered = renderQaEnv(
      'COMPOSE_PROJECT_NAME=soirely\n',
      configs[2].overrides,
      configs[2].project,
    );
    expect(rendered).toMatch(/^COMPOSE_PROJECT_NAME=soirely-qa3$/m);
  });

  it('are known by their worktree', () => {
    expect(testerOf('/Users/x/Projects/soirely-qa')).toBe(1);
    expect(testerOf('/Users/x/Projects/soirely-qa3')).toBe(3);
    expect(testerOf('/Users/x/Projects/soirely')).toBeNull();
  });

  it('stop at three', () => {
    expect(() => qaConfig(4)).toThrow(/no QA tester 4/);
  });
});
