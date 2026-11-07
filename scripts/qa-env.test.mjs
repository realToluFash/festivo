import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  allowCleartext,
  answers,
  emulatorJournalArgs,
  emulatorUnitGone,
  waitForBoot,
  apiControl,
  withoutReverse,
  apiMoves,
  apiStateOf,
  startServices,
  batchCheck,
  batchFlow,
  batchRuns,
  afterRun,
  assertBundler,
  bundlerCommand,
  coldBatch,
  batchSummary,
  physicalSize,
  portraitRotation,
  ANDROID_START,
  batchReset,
  expoGoPrefs,
  TOOLS_BUTTON,
  SCREEN_READER_OFF,
  driverBuilds,
  driverPids,
  bundlerEnv,
  commitTarget,
  checkId,
  codeStep,
  databaseCommands,
  dependencySteps,
  composeBatch,
  localise,
  parseBatch,
  readyReport,
  REBUILD,
  rerunHints,
  runId,
  runAsync,
  runBudgetMs,
  startHelper,
  membershipChanges,
  domainPause,
  STEP_MS,
  totp,
  androidFlows,
  androidPackage,
  androidSdk,
  branchForStory,
  clearApiCache,
  defaultNetwork,
  COMPOSE_PROJECT,
  emulatorAbi,
  emulatorFor,
  emulatorGpu,
  expoGoApk,
  expoGoFits,
  expoGoIosClient,
  expoGoRunning,
  expoSdkMajor,
  flowUrls,
  forAndroid,
  openIntent,
  linkIntent,
  MAX_RESUMES,
  renewingSession,
  resumeBatch,
  runHeld,
  maestroTarget,
  missingCmdlineTools,
  parseTarget,
  hardwareKeyboardOff,
  passwordAutoFillFiles,
  passwordAutoFillOff,
  playImage,
  QA_OVERRIDES,
  QA_PORTS,
  LAN,
  LAN_PROXY_COMPOSE,
  PROXIED,
  certCovers,
  ensureLanCertificate,
  lanCaDir,
  lanProxy,
  lanAddress,
  qaConfig,
  qrPng,
  APP_SERVICES,
  launchVideo,
  recordingSize,
  mp4Duration,
  launchTime,
  launchRecorded,
  launchStarted,
  retakeReason,
  surfaceOrientation,
  iosBundle,
  clearIosRelease,
  uninstallHeld,
  UNINSTALL_BOOTS,
  iosReleases,
  recordIosRelease,
  releaseApk,
  releaseApp,
  releasePlatform,
  simulatorArch,
  staleBuilds,
  iosReleaseBuildArgs,
  xcodeWorkspace,
  renderQaEnv,
  reversedPorts,
  simulatorFor,
  TESTERS,
  testerOf,
  experienceResumed,
  lastBundleRun,
  reloadUntilRun,
  openUntilShown,
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

    for (const [key, list] of Object.entries(values)) {
      for (const value of list.split(/[ ,]/)) {
        if (
          !/^https?:\/\//.test(value) ||
          /^https?:\/\/(postgres|redis|mercure|storage|mailpit|smocker|oidc)\b/.test(value)
        )
          continue;
        for (const port of developmentPorts) {
          expect(value, key).not.toMatch(new RegExp(`:${port}\\b`));
        }
        expect(value, key).not.toContain('localhost');
      }
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

// compose.yaml reads the .env, and its defaults name the development stack. An override it
// never reads leaves the default in force, which is how the sign-in sandbox once stayed on
// the developer's port for every QA stack.
describe('the QA .env against compose.yaml', () => {
  const compose = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
  const readByTheHarness = [
    'COMPOSE_PROJECT_NAME',
    'MAILPIT_URL',
    'METRO_PORT',
    'AGENT_GATEWAY_PORT',
  ];

  it('sets only what compose reads', () => {
    for (const key of Object.keys(QA_OVERRIDES)) {
      if (readByTheHarness.includes(key)) continue;
      expect(compose, `compose.yaml never reads ${key}`).toMatch(new RegExp(`\\$\\{${key}[:}]`));
    }
  });

  it('overrides every default that reaches the development stack', () => {
    const defaults = [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):-([^}]*)/g)];
    const local = defaults.filter(([, , value]) => value.includes('localhost'));

    expect(local.length).toBeGreaterThan(5);
    for (const [, key] of local) {
      expect(QA_OVERRIDES, `${key} keeps its development default`).toHaveProperty(key);
    }
  });

  it('sends every sign-in to its own sandbox', () => {
    for (const tester of TESTERS) {
      const { ports, overrides, app } = qaConfig(tester);
      const sandbox = `http://127.0.0.1:${ports.OIDC_PORT}/`;
      const signIn = [
        overrides.SOIRELY_GOOGLE_AUTHORIZE_URL,
        overrides.SOIRELY_APPLE_AUTHORIZE_URL,
        app.EXPO_PUBLIC_GOOGLE_AUTHORIZE_URL,
        app.EXPO_PUBLIC_GOOGLE_TOKEN_URL,
        app.EXPO_PUBLIC_APPLE_AUTHORIZE_URL,
        app.EXPO_PUBLIC_APPLE_TOKEN_URL,
      ];

      for (const url of signIn) expect(url).toMatch(new RegExp(`^${sandbox}`));
      expect(overrides.OAUTH_GOOGLE_ISSUERS.split(',')).toContain(`${sandbox}google`);
      expect(overrides.OAUTH_APPLE_ISSUERS.split(',')).toContain(`${sandbox}apple`);
      expect(app.EXPO_PUBLIC_API_URL).toBe(`http://127.0.0.1:${ports.API_PORT}`);
      expect(app.EXPO_PUBLIC_MERCURE_URL).toBe(
        `http://127.0.0.1:${ports.MERCURE_PORT}/.well-known/mercure`,
      );
    }
  });

  it('signs in whoever the tester types, so two owners are two accounts', () => {
    for (const tester of TESTERS) {
      const name = qaConfig(tester).overrides.OIDC_CONFIG;
      const sandbox = JSON.parse(
        readFileSync(new URL(`../infra/oidc/${name}`, import.meta.url), 'utf8'),
      );

      expect(sandbox.interactiveLogin).toBe(true);
      expect(sandbox.loginPagePath).toBe('/config/login.html');
    }
    expect(compose).toContain('JSON_CONFIG_PATH: /config/${OIDC_CONFIG:-oidc.json}');
  });

  it('gives each typed name the verified email a first provider sign-in needs', () => {
    const page = readFileSync(new URL('../infra/oidc/login.html', import.meta.url), 'utf8');
    const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
    const signIn = (typed) => {
      const form = { username: { value: typed }, claims: { value: '' } };
      let submit;
      runInNewContext(script, {
        document: {
          querySelector: () => ({ addEventListener: (_, handler) => (submit = handler) }),
        },
      });
      submit({ target: form });
      return JSON.parse(form.claims.value);
    };

    expect(signIn('owner-a')).toEqual({ email: 'owner-a@example.com', email_verified: true });
    expect(signIn(' owner b ')).toEqual({ email: 'owner-b@example.com', email_verified: true });
    expect(signIn('guest@example.org')).toEqual({
      email: 'guest@example.org',
      email_verified: true,
    });
  });
});

describe('the stack a person tests on', () => {
  it('serves every address on the network address, on ports no other stack holds', () => {
    const { project, urls, app, ports } = qaConfig(LAN, '192.168.1.40');

    expect(project).toBe('soirely-qa-lan');
    expect(urls.web).toBe(`https://192.168.1.40:${ports.WEB_PORT}`);
    expect(urls.metro).toBe(`exp://192.168.1.40:${ports.METRO_PORT}`);
    expect(app.EXPO_PUBLIC_API_URL).toBe(`https://192.168.1.40:${ports.API_PORT}`);
    expect(app.REACT_NATIVE_PACKAGER_HOSTNAME).toBe('192.168.1.40');
    const taken = new Set(TESTERS.flatMap((tester) => Object.values(qaConfig(tester).ports)));
    for (const port of Object.values(ports)) {
      expect(taken.has(port)).toBe(false);
      expect(port).toBeLessThan(65536);
    }
  });

  it('builds every proxied address over https, and leaves the bundler on http', () => {
    const { urls, app, overrides, ports } = qaConfig(LAN, '192.168.1.40');
    const host = 'https://192.168.1.40';

    expect(urls.api).toBe(`${host}:${ports.API_PORT}`);
    expect(urls.mercure).toBe(`${host}:${ports.MERCURE_PORT}/.well-known/mercure`);
    expect(urls.mailpit).toBe(`${host}:${ports.MAILPIT_UI_PORT}`);
    expect(overrides.STORAGE_PUBLIC_ENDPOINT).toBe(`${host}:${ports.STORAGE_PORT}`);
    expect(overrides.SOIRELY_GOOGLE_AUTHORIZE_URL).toBe(
      `${host}:${ports.OIDC_PORT}/google/authorize`,
    );
    expect(overrides.CORS_EXPO_WEB_ORIGIN).toBe(`http://192.168.1.40:${ports.METRO_PORT}`);
    for (const [key, value] of Object.entries(app)) {
      if (key.endsWith('_URL')) expect(value, key).toMatch(/^https:\/\//);
    }
    expect(overrides.COMPOSE_FILE).toBe(`compose.yaml:${LAN_PROXY_COMPOSE}`);
  });

  it('leaves the agent stacks on plain http at 127.0.0.1, with no proxy', () => {
    for (const tester of TESTERS) {
      const { urls, overrides, app } = qaConfig(tester);
      expect(urls.api).toMatch(/^http:\/\/127\.0\.0\.1:/);
      expect(app.EXPO_PUBLIC_API_URL).toMatch(/^http:\/\/127\.0\.0\.1:/);
      expect(overrides.COMPOSE_FILE).toBeUndefined();
    }
  });

  it('puts the proxy on every proxied port and takes those ports off the services', () => {
    const { ports } = qaConfig(LAN, '192.168.1.40');
    const { caddyfile, compose } = lanProxy(ports, '192.168.1.40', '/ca', 'AB:CD');

    for (const [key, upstream] of Object.entries(PROXIED)) {
      expect(caddyfile).toContain(`https://:${ports[key]} {`);
      expect(caddyfile).toContain(`reverse_proxy ${upstream}`);
      expect(compose).toContain(`- '${ports[key]}:${ports[key]}'`);
    }
    for (const name of ['api', 'web', 'mercure', 'oidc', 'storage']) {
      expect(compose).toContain(`  ${name}:\n    ports: !reset []`);
    }
    expect(compose).toContain(
      `mailpit:\n    ports: !override\n      - '${ports.MAILPIT_SMTP_PORT}:1025'`,
    );
    expect(compose).toContain('- ./.qa/lan/Caddyfile:/etc/caddy/Caddyfile:ro');
    expect(compose).toContain('- /ca/server.key:/certs/server.key:ro');
    expect(compose).not.toContain('ca.key');
    expect(compose).toContain("soirely.certificate: 'AB:CD'");
  });

  it('issues a certificate for the LAN address from a CA of its own, and re-issues it when the address moves', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-lan-ca-'));
    try {
      const first = ensureLanCertificate(dir, '192.168.1.40');
      expect(first).toMatchObject({ made: true, issued: true });
      const ca = readFileSync(join(dir, 'ca.crt'), 'utf8');
      const server = new X509Certificate(readFileSync(join(dir, 'server.crt')));
      expect(server.subjectAltName).toBe('IP Address:192.168.1.40');
      expect(server.checkIssued(new X509Certificate(ca))).toBe(true);
      expect(new X509Certificate(ca).ca).toBe(true);
      expect(statSync(join(dir, 'ca.key')).mode & 0o077).toBe(0);
      expect(statSync(join(dir, 'server.key')).mode & 0o077).toBe(0);

      expect(ensureLanCertificate(dir, '192.168.1.40')).toMatchObject({
        made: false,
        issued: false,
      });

      expect(ensureLanCertificate(dir, '10.0.0.9')).toMatchObject({ made: false, issued: true });
      const moved = new X509Certificate(readFileSync(join(dir, 'server.crt')));
      expect(moved.subjectAltName).toBe('IP Address:10.0.0.9');
      expect(readFileSync(join(dir, 'ca.crt'), 'utf8')).toBe(ca);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('counts a certificate near its expiry as not covering the address', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-lan-ca-'));
    try {
      ensureLanCertificate(dir, '192.168.1.40');
      const server = readFileSync(join(dir, 'server.crt'), 'utf8');
      const ca = readFileSync(join(dir, 'ca.crt'), 'utf8');
      const expiry = Date.parse(new X509Certificate(server).validTo);
      expect(certCovers(server, ca, '192.168.1.40', expiry - 60 * 24 * 3600 * 1000)).toBe(true);
      expect(certCovers(server, ca, '192.168.1.40', expiry - 24 * 3600 * 1000)).toBe(false);
      expect(certCovers(null, ca, '192.168.1.40')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the CA in the home directory unless SOIRELY_QA_LAN_CA names another', () => {
    expect(lanCaDir({}, '/home/me')).toBe('/home/me/.soirely/qa-lan-ca');
    expect(lanCaDir({ SOIRELY_QA_LAN_CA: '/elsewhere' }, '/home/me')).toBe('/elsewhere');
  });

  it('makes no simulators or emulators: the person brings the phone', () => {
    expect(qaConfig(LAN, '192.168.1.40').simulated).toBe(false);
    expect(TESTERS.every((tester) => qaConfig(tester).simulated)).toBe(true);
  });

  it('takes QA_LAN_ADDRESS, else the private IPv4 address a phone reaches', () => {
    const interfaces = {
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      docker0: [{ family: 'IPv4', internal: false, address: '172.17.0.1' }],
      'br-0a1b2c': [{ family: 'IPv4', internal: false, address: '172.18.0.1' }],
      wlan0: [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv4', internal: false, address: '192.168.1.40' },
      ],
    };

    expect(lanAddress({ QA_LAN_ADDRESS: '10.0.0.9' }, interfaces)).toBe('10.0.0.9');
    expect(lanAddress({}, interfaces)).toBe('192.168.1.40');
    expect(() => lanAddress({}, { lo: interfaces.lo })).toThrow(/QA_LAN_ADDRESS/);
  });

  it('draws the Expo Go QR code as a PNG a person can scan', () => {
    const modules = Uint8Array.from([1, 0, 0, 1]);
    const png = qrPng(modules, 2, 1);
    const side = (2 + 2 * 1) * 2;

    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([side, side]);
    const idat = png.indexOf('IDAT', 0, 'latin1');
    const rows = inflateSync(png.subarray(idat + 4, idat + png.readUInt32BE(idat - 4) + 4));
    const pixel = (x, y) => rows[y * (side + 1) + 1 + x];
    expect([pixel(0, 0), pixel(2, 2), pixel(4, 2), pixel(4, 4), pixel(2, 4)]).toEqual([
      255, 0, 255, 0, 255,
    ]);
  });

  it('is the tester of its own worktree', () => {
    expect(testerOf('/home/me/soirely-qa-lan')).toBe(LAN);
    expect(testerOf('/home/me/soirely-qa2')).toBe(2);
  });
});

describe('the bundler environment', () => {
  it('starts Metro without a file watcher, for the QA app', () => {
    const env = bundlerEnv({ PATH: '/bin', CI: '' }, { EXPO_PUBLIC_API_URL: 'http://api' });

    expect(env).toEqual({
      PATH: '/bin',
      EXPO_PUBLIC_API_URL: 'http://api',
      EXPO_PUBLIC_ENVIRONMENT: 'qa',
      CI: '1',
    });
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
    ['e58c423', { kind: 'commit', sha: 'e58c423' }],
    ['E58C4234ABCDEF', { kind: 'commit', sha: 'e58c4234abcdef' }],
    ['1234567', { kind: 'pr', number: 1234567 }],
    ['deadbee/fix', { kind: 'branch', name: 'deadbee/fix' }],
    [undefined, { kind: 'branch', name: 'main' }],
  ])('%s', (arg, expected) => {
    expect(parseTarget(arg)).toEqual(expected);
  });
});

describe('a commit checkout asks for', () => {
  it('stops on a hash the fetched remote does not have, naming it', () => {
    expect(() =>
      commitTarget('deadbee', { verify: () => null, remoteBranchesWith: () => '' }),
    ).toThrow(/deadbee/);
  });

  it('stops on a hash only the local object store still holds, as after a force-push', () => {
    const verify = () => 'e58c4234abcdef';
    expect(() => commitTarget('e58c423', { verify, remoteBranchesWith: () => '' })).toThrow(
      /no branch on origin holds e58c423/,
    );
  });

  it('checks out a hash it has, and names it by that hash', () => {
    const asked = [];
    const verify = (rev) => (asked.push(rev), 'e58c4234abcdef');
    const remoteBranchesWith = () => '  origin/feature/sc-1/x\n';
    expect(commitTarget('e58c423', { verify, remoteBranchesWith })).toEqual({
      ref: 'e58c423',
      label: 'e58c423',
    });
    expect(asked).toEqual(['e58c423^{commit}']);
  });
});

describe('the simulator ios opens', () => {
  it.each([
    [[], { open: 'phone', shut: ['ipad', 'se'] }],
    [['--phone'], { open: 'phone', shut: ['ipad', 'se'] }],
    [['--ipad'], { open: 'ipad', shut: ['phone', 'se'] }],
    [['--se'], { open: 'se', shut: ['phone', 'ipad'] }],
  ])('%j opens one and shuts the others', (args, expected) => {
    expect(simulatorFor(args)).toEqual(expected);
  });

  it.each(TESTERS)("opens tester %i's own iPhone SE, with nothing renamed", (tester) => {
    const { simulators } = qaConfig(tester);
    const label = tester === 1 ? 'Soirely QA' : `Soirely QA${tester}`;
    expect(simulators[simulatorFor(['--se']).open].name).toBe(`${label} iPhone SE`);
    expect(simulators.phone.name).toBe(`${label} iPhone`);
  });
});

describe('the device a maestro run drives', () => {
  it.each(TESTERS)("is tester %i's own iPhone, through their own driver port", (tester) => {
    const port = qaConfig(tester).driverPort;
    expect(maestroTarget('UDID', false, port)).toEqual([
      '--device',
      'UDID',
      '--driver-host-port',
      String(22087 + tester),
    ]);
  });

  it('is only the emulator on android, which has no shared driver', () => {
    expect(maestroTarget('emulator-5564', true, 22088)).toEqual(['--device', 'emulator-5564']);
  });
});

describe('the emulator android opens', () => {
  it.each([
    [[], { open: 'phone', shut: 'tablet' }],
    [['--phone'], { open: 'phone', shut: 'tablet' }],
    [['--tablet'], { open: 'tablet', shut: 'phone' }],
  ])('%j opens one and shuts the other', (args, expected) => {
    expect(emulatorFor(args)).toEqual(expected);
  });
});

describe('the screen reader on an emulator android opens', () => {
  const at = (name) => ANDROID_START.findIndex((part) => part.name === name);
  const off = ANDROID_START.findIndex((part) => part.adb === SCREEN_READER_OFF);

  it('is switched off, services and the master switch both', () => {
    expect(SCREEN_READER_OFF).toEqual([
      ['shell', 'settings', 'delete', 'secure', 'enabled_accessibility_services'],
      ['shell', 'settings', 'put', 'secure', 'accessibility_enabled', '0'],
    ]);
  });

  it('goes off before Expo Go is launched or its menu tapped', () => {
    expect(off).toBeGreaterThanOrEqual(0);
    expect(off).toBeLessThan(at('Expo Go launched'));
    expect(off).toBeLessThan(at('Expo Go menu dismissed'));
  });

  it('says so, so a tester turns it on again', () => {
    expect(ANDROID_START[off].say).toMatch(/TalkBack is off/);
  });
});

describe('what a batch resets before it signs in', () => {
  const prefs =
    '/sims/UDID/data/Containers/Data/Application/X/Library/Preferences/host.exp.Exponent';

  it('turns TalkBack off on an emulator, with the same commands android uses', () => {
    expect(batchReset(true, 'emulator-5554').adb).toBe(SCREEN_READER_OFF);
  });

  it("turns Expo Go's Tools button off in its own container, with Expo Go closed first", () => {
    const { terminate, write, say } = batchReset(false, 'UDID', { prefs, toolsButton: null });
    expect(terminate).toEqual(['simctl', 'terminate', 'UDID', 'host.exp.Exponent']);
    expect(write).toEqual([
      'simctl',
      'spawn',
      'UDID',
      'defaults',
      'write',
      prefs,
      TOOLS_BUTTON,
      '-bool',
      'NO',
    ]);
    expect(say).toMatch(/turned off/);
  });

  it("has a line for a write that fails, pointing the tester to Expo Go's menu", () => {
    expect(batchReset(false, 'UDID', { prefs, toolsButton: null }).failed).toBe(
      "  Could not turn Expo Go's Tools button off: turn it off in Expo Go's menu.",
    );
  });

  it('turns the Tools button off when it was left on', () => {
    expect(batchReset(false, 'UDID', { prefs, toolsButton: '1' }).write).toContain(TOOLS_BUTTON);
  });

  it('leaves Expo Go alone when its Tools button is already off, and says so', () => {
    expect(batchReset(false, 'UDID', { prefs, toolsButton: '0' })).toEqual({
      say: "  Expo Go's Tools button is off.",
    });
  });

  it('touches nothing on a simulator without Expo Go', () => {
    expect(batchReset(false, 'UDID', { prefs: null }).write).toBeUndefined();
  });

  it("reads Expo Go's preferences from its data container", () => {
    expect(expoGoPrefs('/c')).toBe('/c/Library/Preferences/host.exp.Exponent');
    expect(expoGoPrefs(null)).toBeNull();
  });
});

describe('the GPU mode an emulator starts with', () => {
  it.each([
    ['linux', {}, 'swangle_indirect'],
    ['darwin', {}, 'host'],
    ['linux', { SOIRELY_QA_EMULATOR_GPU: 'host' }, 'host'],
    ['darwin', { SOIRELY_QA_EMULATOR_GPU: 'swiftshader_indirect' }, 'swiftshader_indirect'],
  ])('on %s with %j is %s', (platform, env, expected) => {
    expect(emulatorGpu(platform, env)).toBe(expected);
  });
});

// A port left out is the app on an emulator failing to reach the stack, with the same URL
// that works on a simulator.
describe('the ports an emulator is given', () => {
  it('cover everything the app reaches', () => {
    for (const tester of TESTERS) {
      const { ports, urls, overrides, app } = qaConfig(tester);
      const reached = [
        ...Object.values(app),
        urls.metro,
        overrides.MERCURE_PUBLIC_URL,
        overrides.STORAGE_PUBLIC_ENDPOINT,
      ].map((url) => Number(new URL(url.replace(/^exp:/, 'http:')).port));

      for (const port of reached) expect(reversedPorts(ports)).toContain(port);
    }
  });

  it('leave the databases on the host', () => {
    const ports = reversedPorts(QA_PORTS);
    expect(ports).not.toContain(QA_PORTS.POSTGRES_PORT);
    expect(ports).not.toContain(QA_PORTS.REDIS_PORT);
  });
});

describe('the Android SDK', () => {
  it('is ANDROID_HOME, then ANDROID_SDK_ROOT', () => {
    expect(androidSdk({ ANDROID_HOME: '/a', ANDROID_SDK_ROOT: '/b' }, 'linux', '/h')).toBe('/a');
    expect(androidSdk({ ANDROID_SDK_ROOT: '/b' }, 'linux', '/h')).toBe('/b');
  });

  it('is where Android Studio puts it, without either', () => {
    expect(androidSdk({}, 'linux', '/h')).toBe('/h/Android/Sdk');
    expect(androidSdk({}, 'darwin', '/h')).toBe('/h/Library/Android/sdk');
  });
});

describe('a release build', () => {
  it("is for the emulator's architecture", () => {
    expect(emulatorAbi('x64')).toBe('x86_64');
    expect(emulatorAbi('arm64')).toBe('arm64-v8a');
  });

  it('is kept under the commit it was built from', () => {
    expect(releaseApk('/qa', 'c8646738ce1413ea1e718dce85ff4973f0f9b22c')).toBe(
      '/qa/.qa/release/soirely-c8646738ce14.apk',
    );
  });

  it('leaves only the APK of the commit just built', () => {
    const apk = releaseApk('/qa', 'c8646738ce1413ea1e718dce85ff4973f0f9b22c');
    expect(
      staleBuilds(
        [
          'soirely-c8646738ce14.apk',
          'soirely-0123456789ab.apk',
          'installed',
          'launch-0123456789ab.mp4',
        ],
        apk,
      ),
    ).toEqual(['soirely-0123456789ab.apk']);
  });

  it('records the tablet at half its size, where the encoder records 0.05 s at full size', () => {
    expect(recordingSize('Physical size: 1600x2560\n')).toBe('800x1280');
    expect(recordingSize('Physical size: 2560x1600\nOverride size: 1280x800\n')).toBe('1280x800');
  });

  it('records a landscape-native tablet drawn in portrait in portrait, not letterboxed', () => {
    expect(recordingSize('Physical size: 2560x1600\n', 1)).toBe('800x1280');
    expect(recordingSize('Physical size: 2560x1600\n', 3)).toBe('800x1280');
    expect(recordingSize('Physical size: 2560x1600\n', 2)).toBe('1280x800');
  });

  it('reads the display rotation from dumpsys input, 0 when it is not there', () => {
    expect(surfaceOrientation('    Viewport INTERNAL\n      SurfaceOrientation: 1\n')).toBe(1);
    expect(
      surfaceOrientation(
        '  Viewport INTERNAL: displayId=0, uniqueId=local:1, orientation=3, logicalFrame=[0, 0, 1600, 2560]\n',
      ),
    ).toBe(3);
    expect(surfaceOrientation('error: no devices')).toBe(0);
    expect(surfaceOrientation(null)).toBe(0);
  });

  it('reads the physical size, and nothing from an answer without one', () => {
    expect(physicalSize('Physical size: 2560x1600\nOverride size: 1280x800\n')).toEqual({
      width: 2560,
      height: 1600,
    });
    expect(physicalSize('error: no devices')).toBeNull();
  });

  it('records the phone at its own size', () => {
    expect(recordingSize('Physical size: 1080x2400\n')).toBeNull();
    expect(recordingSize(null)).toBeNull();
  });

  it("reads a recording's length from its movie header, in both header versions", () => {
    const mvhd = (version, scale, length) => {
      const box = Buffer.alloc(version === 1 ? 40 : 28);
      box.write('mvhd', 4);
      box[8] = version;
      if (version === 1) {
        box.writeUInt32BE(scale, 28);
        box.writeBigUInt64BE(BigInt(length), 32);
      } else {
        box.writeUInt32BE(scale, 20);
        box.writeUInt32BE(length, 24);
      }
      box.writeUInt32BE(box.length, 0);
      return Buffer.concat([mp4Header(8 + box.length, 'moov'), box]);
    };
    expect(mp4Duration(mvhd(0, 1000, 700))).toBe(0.7);
    expect(mp4Duration(mvhd(1, 90000, 1593000))).toBe(17.7);
    expect(mp4Duration(mvhd(0, 0, 700))).toBeNull();
    expect(mp4Duration(mvhd(0, 1000, 700).subarray(0, 30))).toBeNull();
    expect(mp4Duration(Buffer.from('no header here'))).toBeNull();
  });

  it('reads the movie header inside moov, not four matching bytes in the frames before it', () => {
    const mvhd = Buffer.alloc(28);
    mvhd.writeUInt32BE(28, 0);
    mvhd.write('mvhd', 4);
    mvhd.writeUInt32BE(1000, 20);
    mvhd.writeUInt32BE(4967, 24);
    const frames = Buffer.concat([Buffer.from('xxxxmvhd'), Buffer.alloc(40, 0xff)]);
    const file = Buffer.concat([
      mp4Header(16, 'ftyp'),
      Buffer.from('isom\0\0\0\0'),
      mp4Header(8 + frames.length, 'mdat'),
      frames,
      mp4Header(8 + mvhd.length, 'moov'),
      mvhd,
    ]);
    expect(mp4Duration(file)).toBe(4.967);
    expect(mp4Duration(file.subarray(0, file.length - 10))).toBeNull();
  });

  it('takes a recording that ends before the app drew its first screen as cut short, not a still screen', () => {
    expect(launchTime('Status: ok\nActivity: id/.MainActivity\nTotalTime: 2310\nComplete\n')).toBe(
      2310,
    );
    expect(launchTime('Error: Activity not started')).toBeNull();
    expect(
      launchTime(
        'Status: timeout\nLaunchState: UNKNOWN (-1)\nActivity: id/.MainActivity\nWaitTime: 11978\nComplete\n',
      ),
    ).toBeNull();
    expect(launchRecorded(0.7, 1000, 2310)).toBe(false);
    expect(launchRecorded(4.96, 1000, 2310)).toBe(true);
    expect(launchRecorded(null, 1000, 2310)).toBe(false);
  });

  it('takes a timed-out launch as started only while the app is running', () => {
    const timedOut =
      'Status: timeout\nLaunchState: UNKNOWN (-1)\nActivity: id/.MainActivity\nWaitTime: 11978\nComplete\n';
    expect(launchStarted(timedOut, '4242\n')).toBe(true);
    expect(launchStarted(timedOut, '')).toBe(false);
    expect(launchStarted(timedOut, null)).toBe(false);
    expect(launchStarted('Error: Activity not started', '4242')).toBe(false);
    expect(launchStarted('Status: ok\nTotalTime: 2310\nComplete\n', null)).toBe(true);
  });

  it('records again every take that did not show the first screen, and only those', () => {
    expect(retakeReason('not recorded')).toMatch(/no video/);
    expect(retakeReason('cut short')).toMatch(/recording ended/);
    expect(retakeReason('timed out')).toMatch(/timed out/);
    expect(retakeReason('recorded')).toBeNull();
  });

  it('names the launch video by platform and device, so every launch of a commit is kept', () => {
    const sha = 'c8646738ce1413ea1e718dce85ff4973f0f9b22c';
    expect(launchVideo('/qa', sha, 'ios', 'phone')).toBe(
      '/qa/.qa/release/launch-c8646738ce14.ios.phone.mp4',
    );
    expect(launchVideo('/qa', sha, 'ios', 'ipad')).not.toBe(
      launchVideo('/qa', sha, 'ios', 'phone'),
    );
    expect(launchVideo('/qa', sha, 'android', 'phone')).not.toBe(
      launchVideo('/qa', sha, 'ios', 'phone'),
    );
    expect(launchVideo('/qa', sha, 'android', 'tablet')).not.toBe(
      launchVideo('/qa', sha, 'android', 'phone'),
    );
  });

  it('keeps the app beside the APK, and replaces only an older app', () => {
    const app = releaseApp('/qa', 'c8646738ce1413ea1e718dce85ff4973f0f9b22c');
    expect(app).toBe('/qa/.qa/release/soirely-c8646738ce14.app');
    expect(
      staleBuilds(
        ['soirely-c8646738ce14.app', 'soirely-0123456789ab.app', 'soirely-0123456789ab.apk'],
        app,
      ),
    ).toEqual(['soirely-0123456789ab.app']);
  });

  it('is for the simulator on a Mac, unless --android asks for the emulator', () => {
    expect(releasePlatform([], 'darwin')).toBe('ios');
    expect(releasePlatform(['--ipad', '--offline'], 'darwin')).toBe('ios');
    expect(releasePlatform(['--android'], 'darwin')).toBe('android');
    expect(releasePlatform(['--ipad'], 'linux')).toBe('android');
  });

  it("builds for the Mac's own simulator architecture", () => {
    expect(simulatorArch('arm64')).toBe('arm64');
    expect(simulatorArch('x64')).toBe('x86_64');
  });

  it('turns password AutoFill off in every profile file the simulator reads', () => {
    const files = passwordAutoFillFiles('/sims/ABC');
    expect(files).toEqual([
      '/sims/ABC/data/Library/UserConfigurationProfiles/UserSettings.plist',
      '/sims/ABC/data/Library/UserConfigurationProfiles/EffectiveUserSettings.plist',
      '/sims/ABC/data/Library/UserConfigurationProfiles/PublicInfo/PublicEffectiveUserSettings.plist',
    ]);
    expect(passwordAutoFillOff(files[0])).toEqual([
      ['-insert', 'restrictedBool', '-dictionary', files[0]],
      ['-insert', 'restrictedBool.allowPasswordAutoFill', '-dictionary', files[0]],
      ['-replace', 'restrictedBool.allowPasswordAutoFill.value', '-bool', 'NO', files[0]],
    ]);
  });

  it('turns the hardware keyboard off globally and for each QA simulator', () => {
    expect(hardwareKeyboardOff('/p.plist', ['A-1', 'B-2'])).toEqual([
      ['-replace', 'ConnectHardwareKeyboard', '-bool', 'NO', '/p.plist'],
      ['-insert', 'DevicePreferences', '-dictionary', '/p.plist'],
      ['-insert', 'DevicePreferences.A-1', '-dictionary', '/p.plist'],
      ['-replace', 'DevicePreferences.A-1.ConnectHardwareKeyboard', '-bool', 'NO', '/p.plist'],
      ['-insert', 'DevicePreferences.B-2', '-dictionary', '/p.plist'],
      ['-replace', 'DevicePreferences.B-2.ConnectHardwareKeyboard', '-bool', 'NO', '/p.plist'],
    ]);
  });

  it('keeps a release recorded on one simulator when the other is cleared', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-'));
    const recorded = join(root, '.qa/release/ios-release-on');
    mkdirSync(join(root, '.qa/release'), { recursive: true });
    recordIosRelease(root, 'phone');
    recordIosRelease(root, 'ipad');
    recordIosRelease(root, 'phone');
    expect(iosReleases(root)).toEqual(['phone', 'ipad']);
    clearIosRelease(root, 'ipad');
    expect(iosReleases(root)).toEqual(['phone']);
    clearIosRelease(root, 'phone');
    expect(existsSync(recorded)).toBe(false);
    writeFileSync(recorded, 'phone');
    expect(iosReleases(root)).toEqual(['phone']);
    rmSync(root, { recursive: true });
  });

  it('clears an iOS release only once a boot finds it gone', () => {
    const calls = [];
    const device = (present, up = () => true) => ({
      boot: () => calls.push('boot') && up(),
      installed: () => present.shift(),
      uninstall: () => calls.push('uninstall'),
      shut: () => calls.push('shut'),
    });
    expect(uninstallHeld(device([true, true, false]))).toBe(true);
    expect(calls).toEqual(['boot', 'uninstall', 'shut', 'boot', 'uninstall', 'shut', 'boot']);
    calls.length = 0;
    expect(uninstallHeld(device(Array(UNINSTALL_BOOTS).fill(true)))).toBe(false);
    expect(calls.filter((call) => call === 'boot')).toHaveLength(UNINSTALL_BOOTS);
  });

  it('keeps an iOS release recorded when the device does not boot', () => {
    const device = {
      boot: () => false,
      installed: () => false,
      uninstall: () => {},
      shut: () => {},
    };
    expect(uninstallHeld(device)).toBe(false);
  });

  it('installs the bundle the app config names', () => {
    const config = readFileSync(new URL('../apps/mobile/app.config.ts', import.meta.url), 'utf8');
    expect(iosBundle(config)).toBe('com.soirely.app');
    expect(() => iosBundle('ios: { supportsTablet: true }')).toThrow(/bundleIdentifier/);
  });

  it('builds the one workspace prebuild made', () => {
    expect(xcodeWorkspace(['Podfile', 'Soirely.xcodeproj', 'Soirely.xcworkspace'])).toBe(
      'Soirely.xcworkspace',
    );
    expect(() => xcodeWorkspace(['Soirely.xcodeproj'])).toThrow(/found 0/);
  });

  it('signs the release build ad hoc, so the Keychain keeps a session across a cold start', () => {
    const args = iosReleaseBuildArgs('Soirely.xcworkspace', 'Soirely', '/tmp/build', 'arm64');
    expect(args).toContain('CODE_SIGN_IDENTITY=-');
    expect(args).toContain('ARCHS=arm64');
    expect(args).not.toContain('CODE_SIGNING_ALLOWED=NO');
    expect(args.at(-1)).toBe('build');
  });

  it('takes offline as every service the app reaches, stopped', () => {
    const compose = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
    for (const service of APP_SERVICES) {
      expect(compose).toMatch(new RegExp(`^  ${service}:$`, 'm'));
    }
  });

  it('launches offline only once the emulator has no default network', () => {
    expect(defaultNetwork('Active default network: none\n')).toBeNull();
    expect(defaultNetwork('NetworkProviders:\nActive default network: 100\n')).toBe('100');
    expect(() => defaultNetwork("Can't find service: connectivity")).toThrow(/no default network/);
  });

  it("is the app config's Android package", () => {
    const config = readFileSync(join(import.meta.dirname, '../apps/mobile/app.config.ts'), 'utf8');
    expect(androidPackage(config)).toBe('com.soirely.app');
    expect(() => androidPackage('ios: {}')).toThrow(/no android.package/);
  });

  it('may reach a stack over http', () => {
    const manifest = '<manifest>\n  <application android:name=".MainApplication">\n</manifest>';
    expect(allowCleartext(manifest)).toContain(
      '<application android:usesCleartextTraffic="true" android:name=".MainApplication">',
    );
  });

  it('leaves a manifest that already allows http alone', () => {
    const manifest = '<application android:usesCleartextTraffic="true" android:name=".X">';
    expect(allowCleartext(manifest)).toBe(manifest);
  });

  it('is an error when the manifest refuses http', () => {
    const manifest = '<application android:usesCleartextTraffic="false" android:name=".X">';
    expect(() => allowCleartext(manifest)).toThrow(/usesCleartextTraffic="false"/);
  });

  it('is an error when prebuild wrote no application', () => {
    expect(() => allowCleartext('<manifest/>')).toThrow(/no <application>/);
  });
});

describe('the image an emulator is made on', () => {
  const sdkWith = (...paths) => {
    const sdk = mkdtempSync(join(tmpdir(), 'sdk-'));
    for (const path of paths) mkdirSync(join(sdk, 'system-images', path), { recursive: true });
    return sdk;
  };

  it('is the newest Play image installed for this machine', () => {
    const sdk = sdkWith(
      'android-35/google_apis_playstore/arm64-v8a',
      'android-37.0/google_apis_playstore_ps16k/arm64-v8a',
      'android-37.0/google_apis/arm64-v8a',
      'android-38/google_apis_playstore/x86_64',
    );
    expect(playImage(sdk, 'arm64')).toBe(
      'system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a',
    );
  });

  it('passes over a file beside the images, as Finder leaves', () => {
    const sdk = sdkWith('android-37.0/google_apis_playstore_ps16k/arm64-v8a');
    writeFileSync(join(sdk, 'system-images', '.DS_Store'), '');
    expect(playImage(sdk, 'arm64')).toBe(
      'system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a',
    );
  });

  it('follows an image directory that is a link', () => {
    const elsewhere = sdkWith('android-37.0/google_apis_playstore_ps16k/arm64-v8a');
    const sdk = sdkWith();
    mkdirSync(join(sdk, 'system-images'));
    symlinkSync(
      join(elsewhere, 'system-images', 'android-37.0'),
      join(sdk, 'system-images', 'android-37.0'),
    );
    expect(playImage(sdk, 'arm64')).toBe(
      'system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a',
    );
  });

  it('passes over a link whose image has gone, as on an unmounted disk', () => {
    const elsewhere = sdkWith('android-36/google_apis_playstore/arm64-v8a');
    const sdk = sdkWith('android-37.0/google_apis_playstore_ps16k/arm64-v8a');
    symlinkSync(
      join(elsewhere, 'system-images', 'android-36'),
      join(sdk, 'system-images', 'android-36'),
    );
    rmSync(elsewhere, { recursive: true });
    expect(playImage(sdk, 'arm64')).toBe(
      'system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a',
    );
  });

  it('is a released version, never a preview', () => {
    const sdk = sdkWith(
      'android-37.0/google_apis_playstore_ps16k/arm64-v8a',
      'android-CANARY/google_apis_playstore/arm64-v8a',
    );
    expect(playImage(sdk, 'arm64')).toBe(
      'system-images;android-37.0;google_apis_playstore_ps16k;arm64-v8a',
    );
  });

  it('is never a Google APIs image, which has no TalkBack', () => {
    expect(playImage(sdkWith('android-37/google_apis/x86_64'), 'x64')).toBe(
      'system-images;android-35;google_apis_playstore;x86_64',
    );
  });
});

describe('Expo Go for Android', () => {
  const versions = {
    sdkVersions: {
      '56.0.0': {
        androidClientUrl: 'https://x/Expo-Go-56.0.4.apk',
        androidClientVersion: '56.0.4',
      },
      '57.0.0': {
        androidClientUrl: 'https://x/Expo-Go-57.0.9.apk',
        androidClientVersion: '57.0.9',
      },
    },
  };

  it('is the one for the SDK the app depends on', () => {
    expect(expoSdkMajor('~57.0.0')).toBe('57');
    expect(expoGoApk(versions, '~57.0.0')).toEqual({
      url: 'https://x/Expo-Go-57.0.9.apk',
      version: '57.0.9',
    });
  });

  it('is found under data as well', () => {
    expect(expoGoApk({ data: versions }, '^56.0.1').version).toBe('56.0.4');
  });

  it('is an error for an SDK Expo has no client for', () => {
    expect(() => expoGoApk(versions, '~58.0.0')).toThrow(/SDK 58/);
  });
});

describe('Expo Go for iOS', () => {
  const versions = {
    sdkVersions: {
      '58.0.0': {
        iosClientUrl: 'https://x/Expo-Go-58.0.2.tar.gz',
        iosClientVersion: '58.0.2',
      },
    },
  };

  it("is kept only when its major is the app's SDK", () => {
    expect(expoGoFits('58.0.2', '~58.0.0')).toBe(true);
    expect(expoGoFits('57.0.9', '~58.0.0')).toBe(false);
    expect(expoGoFits('5.8.0', '~58.0.0')).toBe(false);
  });

  it('is replaced when none is installed or its version is unreadable', () => {
    expect(expoGoFits(null, '~58.0.0')).toBe(false);
    expect(expoGoFits('', '~58.0.0')).toBe(false);
  });

  it("is the simulator client for the app's SDK", () => {
    expect(expoGoIosClient(versions, '~58.0.0')).toEqual({
      url: 'https://x/Expo-Go-58.0.2.tar.gz',
      version: '58.0.2',
    });
    expect(() => expoGoIosClient(versions, '~57.0.0')).toThrow(/iOS for SDK 57/);
  });
});

describe("a flow's URLs", () => {
  it('name the API and the web client, for a second session in a runScript', () => {
    const { urls, ports } = qaConfig(1);
    expect(flowUrls(urls)).toEqual({
      METRO_URL: `exp://127.0.0.1:${ports.METRO_PORT}`,
      MAILPIT_URL: `http://127.0.0.1:${ports.MAILPIT_UI_PORT}`,
      API_URL: `http://127.0.0.1:${ports.API_PORT}`,
      WEB_URL: `http://127.0.0.1:${ports.WEB_PORT}`,
    });
  });
});

describe('a flow on Android', () => {
  const flow = [
    'appId: host.exp.Exponent',
    '---',
    '- launchApp:',
    '    appId: host.exp.Exponent',
    "- assertVisible: 'host.exp.Exponents'",
  ].join('\n');

  it("names Android's package wherever it named iOS's", () => {
    expect(forAndroid(flow)).not.toContain('host.exp.Exponent\n');
    expect(forAndroid(flow).match(/host\.exp\.exponent$/gm)).toHaveLength(2);
  });

  it('is left alone otherwise', () => {
    expect(forAndroid(flow)).toContain("'host.exp.Exponents'");
    expect(forAndroid(forAndroid(flow))).toBe(forAndroid(flow));
  });

  it('has the harness open its links, variables and all, and stop where it cannot', () => {
    const links = [
      '- openLink: ${METRO_URL}',
      '- openLink: ${METRO_URL}/--/',
      '    - openLink: ${METRO_URL}/--/join/${output.link}',
    ].join('\n');
    const step = (indent, path) =>
      `${indent}- evalScript: \${(function (r) { if (!r.ok) ` +
      `throw new Error('the harness could not open ' + ${path} + ', ' + r.body); ` +
      `return r.body; })(http.get(HELPER_URL + '/open?path=' + encodeURIComponent(${path})))}`;
    expect(forAndroid(links).split('\n')).toEqual([
      step('', "''"),
      step('', "'/--/'"),
      step('    ', "'/--/join/' + (output.link)"),
    ]);
    expect(forAndroid(forAndroid(links))).toBe(forAndroid(links));
  });

  it("opens a link in Expo Go's package, not whichever app takes exp://", () => {
    expect(openIntent("exp://127.0.0.1:28081/--/it's")).toEqual([
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      "'exp://127.0.0.1:28081/--/it'\\''s'",
      'host.exp.exponent',
    ]);
  });

  it('tells an open experience from Expo Go on its Home or launcher', () => {
    const resumed = (activity) =>
      `  ResumedActivity: ActivityRecord{2af8410 u0 ${activity} t2150}\n` +
      `  topResumedActivity=ActivityRecord{874cd8c u0 ${activity} t2150}\n`;
    expect(experienceResumed(resumed('host.exp.exponent/.experience.ExperienceActivity'))).toBe(
      true,
    );
    expect(
      experienceResumed(
        '    mResumedActivity: ActivityRecord{874cd8c u0 host.exp.exponent/.experience.ExperienceActivity t2150}\n',
      ),
    ).toBe(true);
    expect(experienceResumed(resumed('host.exp.exponent/.experience.HomeActivity'))).toBe(false);
    expect(experienceResumed(resumed('host.exp.exponent/.LauncherActivity'))).toBe(false);
    expect(
      experienceResumed(
        '  * Hist  #0: ActivityRecord{874cd8c u0 host.exp.exponent/.experience.ExperienceActivity t2150}\n' +
          resumed('host.exp.exponent/.experience.HomeActivity'),
      ),
    ).toBe(false);
    expect(experienceResumed('')).toBe(false);
  });

  it('reads when the app last started from logcat', () => {
    const run = (at) =>
      `${at}  4743  4743 I ReactNativeJS: Running "main" with {"rootTag":1,"initialProps":{}}\n`;
    expect(lastBundleRun('')).toBe(0);
    expect(lastBundleRun('--------- beginning of main\n')).toBe(0);
    expect(
      lastBundleRun(
        run('1793215144.427') +
          '1793215150.001  4743  4743 I ReactNativeJS: Running application\n' +
          run('1793215204.427'),
      ),
    ).toBe(1793215204.427);
  });

  it('answers a reload once the app has run again, or when its time is up', async () => {
    const reloading = (ranAfterPolls) => {
      let at = 0;
      let polls = 0;
      let reloaded = false;
      return {
        options: {
          reload: async () => {
            reloaded = true;
          },
          lastRun: () => (reloaded && polls >= ranAfterPolls ? 200 : 100),
          wait: async (ms) => {
            polls++;
            at += ms;
          },
          now: () => at,
        },
        at: () => at,
      };
    };

    const quick = reloading(2);
    expect(await reloadUntilRun(quick.options)).toBe(true);
    expect(quick.at()).toBe(500);

    const already = reloading(0);
    expect(await reloadUntilRun(already.options)).toBe(true);
    expect(already.at()).toBe(250);

    const never = reloading(Infinity);
    expect(await reloadUntilRun(never.options)).toBe(false);
    expect(never.at()).toBeLessThanOrEqual(8000);
  });

  const clocked = ({ shownAfter = Infinity, sendCost = 0, checkCost = 0 } = {}) => {
    let at = 0;
    const sent = [];
    const checked = [];
    return {
      sent,
      checked,
      options: {
        send: () => {
          sent.push(at);
          at += sendCost;
        },
        shown: () => {
          checked.push(at);
          at += checkCost;
          return checked.length > shownAfter;
        },
        wait: async (ms) => {
          at += ms;
        },
        now: () => at,
      },
      at: () => at,
    };
  };

  it('sends a link Expo Go dropped again, and an opened one only once', async () => {
    const opened = clocked({ shownAfter: 0 });
    expect(await openUntilShown(opened.options)).toBe(1);
    expect(opened.sent).toEqual([0]);

    const dropped = clocked({ shownAfter: 7 });
    expect(await openUntilShown(dropped.options)).toBe(2);
    expect(dropped.sent).toEqual([0, 2500]);

    const never = clocked();
    expect(await openUntilShown(never.options)).toBe(3);
    expect(never.sent).toEqual([0, 2500, 5000]);
    expect(never.at()).toBe(7500);
  });

  it('answers by its deadline when each adb call is slow', async () => {
    const slow = clocked({ sendCost: 300, checkCost: 700 });
    await openUntilShown(slow.options);
    expect([...slow.sent, ...slow.checked].every((at) => at < 8000)).toBe(true);
    expect(slow.at()).toBeLessThan(9000);
  });

  it('stops at the first send am start refuses', async () => {
    await expect(
      openUntilShown({
        send: () => {
          throw new Error('could not open exp://x: Error: Activity not started');
        },
        shown: () => false,
        wait: async () => {},
      }),
    ).rejects.toThrow(/could not open/);
  });

  it('brings the flows it runs, rewritten, where its paths expect them', () => {
    const source = mkdtempSync(join(tmpdir(), 'maestro-'));
    mkdirSync(join(source, 'shared'));
    writeFileSync(join(source, 'verify.yaml'), `${flow}\n- runFlow: shared/open-mail.yaml\n`);
    writeFileSync(join(source, 'shared/open-mail.yaml'), 'appId: host.exp.Exponent\n---\n');
    writeFileSync(join(source, 'shared/read.js'), 'output.code = "host.exp.Exponent"\n');
    const target = join(source, '..', `${source.split('/').pop()}-android`);

    androidFlows(source, target);

    expect(readFileSync(join(target, 'verify.yaml'), 'utf8')).toContain('shared/open-mail.yaml');
    expect(readFileSync(join(target, 'shared/open-mail.yaml'), 'utf8')).toBe(
      'appId: host.exp.exponent\n---\n',
    );
    expect(readFileSync(join(target, 'shared/read.js'), 'utf8')).toContain('host.exp.Exponent');
    expect(readFileSync(join(source, 'shared/open-mail.yaml'), 'utf8')).toContain('Exponent');
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

  it('each have their own project, simulators, emulators, Chrome and Maestro driver', () => {
    for (const key of ['project', 'chromePort', 'emulatorPort', 'driverPort']) {
      expect(new Set(configs.map((c) => c[key])).size, key).toBe(TESTERS.length);
    }
    const names = configs.flatMap((c) =>
      [...Object.values(c.simulators), ...Object.values(c.emulators)].map((d) => d.name),
    );
    expect(new Set(names).size).toBe(names.length);
    expect(configs.map((c) => c.driverPort)).not.toContain(22087);
  });

  it('name emulators an AVD can carry, on a console adb finds', () => {
    expect(configs[1].emulators.phone.name).toBe('Soirely_QA2_Phone');
    for (const { emulators, emulatorPort } of configs) {
      for (const { name } of Object.values(emulators)) expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(emulatorPort % 2).toBe(0);
      expect(emulatorPort).toBeGreaterThan(5554);
      expect(emulatorPort).toBeLessThanOrEqual(5584);
    }
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

describe('handing a provider redirect to Expo Go', () => {
  it('reaches the running experience with the whole link, query and all', () => {
    const intent = linkIntent('soirely://oauth/google?code=a&state=b');
    expect(intent).toContain('host.exp.exponent/host.exp.exponent.experience.ExperienceActivity');
    expect(intent.slice(intent.indexOf('-f'), intent.indexOf('-f') + 2)).toEqual([
      '-f',
      '0x20000000',
    ]);
    expect(intent.at(-1)).toBe("'soirely://oauth/google?code=a&state=b'");
  });

  it("survives a quote in the link on the device's shell", () => {
    expect(linkIntent("soirely://oauth/x?s=it's").at(-1)).toBe("'soirely://oauth/x?s=it'\\''s'");
  });

  it('refuses anything but the app scheme', () => {
    expect(() => linkIntent(undefined)).toThrow(/which link/);
    expect(() => linkIntent('https://soirely.com/oauth')).toThrow(/which link/);
  });
});

describe('the API cache a checkout leaves behind', () => {
  it('is emptied, its directory and the rest of var stay', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-cache-'));
    mkdirSync(join(root, 'services/api/var/cache/dev'), { recursive: true });
    writeFileSync(join(root, 'services/api/var/cache/dev/App_KernelDevDebugContainer.php'), '');
    writeFileSync(join(root, 'services/api/var/cache/.gitkeep'), '');
    mkdirSync(join(root, 'services/api/var/log'), { recursive: true });

    clearApiCache(root);

    expect(readdirSync(join(root, 'services/api/var/cache'))).toEqual([]);
    expect(existsSync(join(root, 'services/api/var/log'))).toBe(true);
  });

  it('is no error when there is none', () => {
    expect(() => clearApiCache(mkdtempSync(join(tmpdir(), 'qa-cache-')))).not.toThrow();
  });
});

describe('a two-factor code', () => {
  // RFC 6238, appendix B: the SHA-1 secret is "12345678901234567890", and six digits are the last six.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [20000000000, '353130'],
  ])('at %i seconds is %s', (seconds, code) => {
    expect(totp(secret, Math.floor(seconds / 30))).toBe(code);
  });

  it('refuses a secret that is not base32', () => {
    expect(() => totp('not-base32!', 1)).toThrow('base32');
  });
});

describe('the step a code is made in', () => {
  it('is now, for an account given none yet', () => {
    expect(codeStep(10 * STEP_MS + 5000, undefined)).toEqual({ step: 10, waitMs: 0 });
  });

  it('is the next one, when this one was given, and waits for it', () => {
    expect(codeStep(10 * STEP_MS + 5000, 10)).toEqual({ step: 11, waitMs: STEP_MS - 5000 });
  });

  it('is now, when the last was long ago', () => {
    expect(codeStep(10 * STEP_MS, 3)).toEqual({ step: 10, waitMs: 0 });
  });
});

describe('a flow in a language', () => {
  const catalogues = {
    en: { settings: { title: 'Settings', signedInAs: 'Signed in as {{email}}' } },
    es: { settings: { title: 'Configuración', signedInAs: 'Sesión iniciada como {{email}}' } },
    fr: { settings: { title: "L'accueil", signedInAs: 'Connecté en tant que {{email}}' } },
  };

  it('takes the batch language', () => {
    expect(localise("visible: '{{t:settings.title}}'", catalogues, 'es')).toBe(
      "visible: 'Configuración'",
    );
  });

  it('takes any language, for a session left in any of them', () => {
    expect(localise("'{{t:any:settings.title}}'", catalogues, 'en')).toBe(
      "'(?:Settings|Configuración|L''accueil)'",
    );
  });

  it('puts the address in, escaped, only where asked', () => {
    const values = { email: 'qa-1@soirely.test' };
    expect(localise('{{t:settings.signedInAs|email}}', catalogues, 'en', values)).toBe(
      'Signed in as qa-1@\\u200B?soirely\\.test',
    );
    expect(localise('{{t:settings.signedInAs}}', catalogues, 'en', values)).toBe('Signed in as .*');
  });

  it('matches the address as the app draws it, broken after its @ or not', () => {
    const pattern = localise('{{t:settings.signedInAs|email}}', catalogues, 'en', {
      email: 'qa-1@soirely.test',
    });
    expect(new RegExp(`^${pattern}$`).test('Signed in as qa-1@\u200Bsoirely.test')).toBe(true);
    expect(new RegExp(`^${pattern}$`).test('Signed in as qa-1@soirely.test')).toBe(true);
  });

  it('names a key no catalogue holds', () => {
    expect(() => localise('{{t:settings.nope}}', catalogues, 'en')).toThrow(
      'no settings.nope in the en',
    );
  });
});

describe('a check in a batch', () => {
  const flow = [
    'appId: host.exp.Exponent',
    '---',
    '- openLink: ${METRO_URL}/--/settings',
    '- takeScreenshot: settings',
    "- takeScreenshot: 'settings-open'",
    '',
  ].join('\n');

  it('reports it started, starts from a reload, names its screenshots, and reports it passed', () => {
    expect(batchCheck(flow, 'settings', 'es', { reset: true })).toBe(
      [
        'appId: host.exp.Exponent',
        '---',
        '- runScript:',
        '    file: ../batch/helper.js',
        '    env:',
        "      ASK: '/started?check=settings.es'",
        '- runFlow: ../batch/reset.yaml',
        '- openLink: ${METRO_URL}/--/settings',
        '- takeScreenshot: settings.es-settings',
        '- takeScreenshot: settings.es-settings-open',
        '- runScript:',
        '    file: ../batch/helper.js',
        '    env:',
        "      ASK: '/passed?check=settings.es'",
        '',
      ].join('\n'),
    );
  });

  it('starts without a reload when it runs alone, cold', () => {
    expect(batchCheck(flow, 'settings', 'any', { reset: false })).not.toContain('reset.yaml');
  });

  it('carries no language in its name when the batch names none', () => {
    expect(checkId('settings', 'any')).toBe('settings');
    expect(checkId('settings', 'es')).toBe('settings.es');
  });
});

describe('the API a check holds', () => {
  it('pauses, stops and brings back only the api service', () => {
    expect(apiMoves('up', 'paused')).toEqual([['pause', 'api']]);
    expect(apiMoves('up', 'stopped')).toEqual([['stop', 'api']]);
    expect(apiMoves('paused', 'up')).toEqual([['unpause', 'api']]);
    expect(apiMoves('stopped', 'up')).toEqual([['up', '-d', '--wait', '--no-recreate', 'api']]);
  });

  it('kills a paused API, since stop thaws it and Caddy answers the held request on SIGTERM', () => {
    expect(apiMoves('paused', 'stopped')).toEqual([['kill', 'api']]);
  });

  it('goes through up from stopped to paused, since only a running container pauses', () => {
    expect(apiMoves('stopped', 'paused')).toEqual([
      ['up', '-d', '--wait', '--no-recreate', 'api'],
      ['pause', 'api'],
    ]);
  });

  it('does nothing when the API is already there', () => {
    for (const state of ['up', 'paused', 'stopped']) expect(apiMoves(state, state)).toEqual([]);
  });

  it("reads the container's state from Docker", () => {
    expect(apiStateOf('running\n')).toBe('up');
    expect(apiStateOf('paused')).toBe('paused');
    expect(apiStateOf('exited')).toBe('stopped');
    expect(apiStateOf('')).toBe('stopped');
  });
});

function dockerDouble(container, { failing = [], healthy } = {}) {
  const ran = [];
  const control = apiControl({
    read: async () => container,
    ...(healthy && { healthy }),
    run: async (args) => {
      ran.push(args.join(' '));
      return !failing.includes(args[0]);
    },
    unreached: async (moves) => {
      ran.push('unreached');
      try {
        return await moves();
      } finally {
        ran.push('reached');
      }
    },
  });
  return { control, ran };
}

describe('the API a batch holds', () => {
  it('starts from what Docker says, not from up', async () => {
    const { control, ran } = dockerDouble('paused');
    await control.move('up');
    expect(ran).toEqual(['unpause api']);
    expect(control.state()).toBe('up');
  });

  it('tracks the state across queued moves', async () => {
    const { control, ran } = dockerDouble('running');
    await Promise.all([control.move('paused'), control.move('stopped'), control.move('up')]);
    expect(ran).toEqual(['pause api', 'kill api', 'up -d --wait --no-recreate api']);
    expect(control.state()).toBe('up');
  });

  it('brings the API up from each state', async () => {
    for (const [container, moves] of [
      ['running', []],
      ['paused', ['unpause api']],
      ['exited', ['up -d --wait --no-recreate api']],
    ]) {
      const { control, ran } = dockerDouble(container);
      await control.move('up');
      expect(ran).toEqual(moves);
      expect(control.state()).toBe('up');
    }
  });

  it('keeps the device from the API while a move passes through up', async () => {
    const { control, ran } = dockerDouble('exited');
    await control.move('paused');
    expect(ran).toEqual(['unreached', 'up -d --wait --no-recreate api', 'pause api', 'reached']);
    expect(control.state()).toBe('paused');
  });

  it('lets the device reach the API on a move of one step', async () => {
    const { control, ran } = dockerDouble('running');
    await control.move('stopped');
    await control.move('up');
    await control.move('paused');
    expect(ran).toEqual(['stop api', 'up -d --wait --no-recreate api', 'pause api']);
  });

  it('gives the device the API back when a move through up fails', async () => {
    const { control, ran } = dockerDouble('exited', { failing: ['pause'] });
    await expect(control.move('paused')).rejects.toThrow('docker compose pause api failed');
    expect(ran).toEqual(['unreached', 'up -d --wait --no-recreate api', 'pause api', 'reached']);
  });

  it('reads Docker again after a move that failed, and the next move still runs', async () => {
    const { control, ran } = dockerDouble('running', { failing: ['stop'] });
    await expect(control.move('stopped')).rejects.toThrow('docker compose stop api failed');
    expect(control.state()).toBeUndefined();
    await control.move('paused');
    expect(ran).toEqual(['stop api', 'pause api']);
    expect(control.state()).toBe('paused');
  });
});

describe('the API brought back up', () => {
  it('returns only once the API answers, from paused as from stopped', async () => {
    for (const container of ['paused', 'exited']) {
      const asked = [];
      const { control, ran } = dockerDouble(container, {
        healthy: async () => {
          asked.push(ran.length);
          return true;
        },
      });
      await control.move('up');
      expect(asked).toEqual([1]);
      expect(control.state()).toBe('up');
    }
  });

  it('fails the move, and reads Docker again, when the API never answers', async () => {
    const { control } = dockerDouble('paused', { healthy: async () => false });
    await expect(control.move('up')).rejects.toThrow('never answered /api/health');
    expect(control.state()).toBeUndefined();
  });

  it('asks nothing when the API was already up, or is being held', async () => {
    let asked = 0;
    const healthy = async () => (asked++, true);
    const { control } = dockerDouble('running', { healthy });
    await control.move('up');
    await control.move('paused');
    await control.move('stopped');
    expect(asked).toBe(0);
  });

  it('polls the health endpoint until it answers, and gives up at the deadline', async () => {
    const replies = [false, false, true];
    const get = async () => ({ ok: replies.shift() });
    expect(await answers('http://api/health', { every: 1, get })).toBe(true);
    expect(replies).toEqual([]);
    const refused = async () => {
      throw new Error('ECONNREFUSED');
    };
    expect(await answers('http://api/health', { ms: 5, every: 1, get: refused })).toBe(false);
  });

  it('gives up on a health request that hangs, so the deadline still holds', async () => {
    const hangs = (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      );
    const started = Date.now();
    expect(await answers('http://api/health', { ms: 20, every: 5, get: hangs })).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('the app services started', () => {
  const started = (ps) => {
    const ran = [];
    startServices(['api', 'web'], {
      capture: () => ps,
      run: (args) => ran.push(args.join(' ')),
    });
    return ran;
  };

  it('unpauses what a killed batch left paused before up, which refuses a paused container', () => {
    expect(started('api\nmercure\n')).toEqual([
      'unpause api mercure',
      'up -d --wait --no-recreate api web',
    ]);
  });

  it('goes straight to up when nothing is paused', () => {
    expect(started('')).toEqual(['up -d --wait --no-recreate api web']);
    expect(started(null)).toEqual(['up -d --wait --no-recreate api web']);
  });
});

describe('a check that holds the API', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../apps/mobile/.maestro/checks');
  const checks = readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => [name, readFileSync(join(dir, name), 'utf8')]);

  const holds = (flow) => /ASK: '?\/api\?to=(paused|stopped)/.test(flow);
  const subflows = (flow) =>
    [...flow.matchAll(/^\s*(?:-\s*runFlow:|file:)\s*(\S+\/\S+\.yaml)\s*$/gm)]
      .map(([, path]) => join(dir, path))
      .filter((path) => path.startsWith(`${dir}/`) && existsSync(path));

  it('brings it back up in onFlowComplete, so a failed wait leaves the next check a live API', () => {
    const holding = checks.filter(
      ([, flow]) => holds(flow) || subflows(flow).some((path) => holds(readFileSync(path, 'utf8'))),
    );
    expect(holding.map(([name]) => name)).toContain('sc11786-members-states.yaml');
    const unguarded = holding
      .filter(([, flow]) => {
        const header = flow.slice(0, flow.indexOf('\n---\n'));
        return !/onFlowComplete:[\s\S]*ASK: \/api\?to=up/.test(header);
      })
      .map(([name]) => name);
    expect(unguarded).toEqual([]);
  });

  // sc-30216 moves sc27096-ipad-side-refreshing.yaml off its own 18999 trigger onto /api?to=.
  it('reaches the harness through batch/helper.js, never a literal port', () => {
    const literal = checks.filter(([, flow]) => /127\.0\.0\.1:\d+/.test(flow)).map(([n]) => n);
    expect(literal).toEqual(['sc27096-ipad-side-refreshing.yaml']);
  });
});

describe('portraitRotation', () => {
  it('turns a landscape-native display a quarter, and leaves a phone at 0', () => {
    expect(portraitRotation('Physical size: 2560x1600\n')).toBe(1);
    expect(portraitRotation('Physical size: 1080x2400\nOverride size: 2400x1080\n')).toBe(0);
  });

  it('refuses an answer with no size in it', () => {
    expect(() => portraitRotation('error: no devices')).toThrow('no display size in wm size');
    expect(() => portraitRotation(null)).toThrow('no display size in wm size');
  });
});

describe('the batch helper', () => {
  const helperFor = async (container, open, options = {}) => {
    const { control, ran } = dockerDouble(container);
    const languages = [];
    const begun = [];
    const server = await startHelper({
      setLocale: async (locale) => {
        languages.push(locale);
        ran.push(`locale ${locale}`);
      },
      apiState: control,
      passed: new Set(),
      begun,
      heard: { at: 0 },
      open: open ?? ((url) => ran.push(`open ${url}`)),
      ...options,
      port: 0,
    });
    const ask = async (path) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
      return response.json();
    };
    return { server, ask, control, ran, languages, begun };
  };

  it('holds the API for a check, and brings it back when the next check starts', async () => {
    const { server, ask, control, ran, begun } = await helperFor('running');
    try {
      expect(await ask('/api?to=paused')).toEqual({ api: 'paused' });
      expect(await ask('/started?check=settings')).toEqual({});
      expect(ran).toEqual(['pause api', 'unpause api']);
      expect(control.state()).toBe('up');
      expect(begun).toEqual(['settings']);
    } finally {
      server.close();
    }
  });

  it('brings a held API back before it switches the language', async () => {
    const { server, ask, ran } = await helperFor('running');
    try {
      expect(await ask('/api?to=paused')).toEqual({ api: 'paused' });
      expect(await ask('/language?to=es')).toEqual({ language: 'es' });
      expect(ran).toEqual(['pause api', 'unpause api', 'locale es']);
    } finally {
      server.close();
    }
  });

  it('turns an Android device to portrait, and leaves iOS to Maestro', async () => {
    const turned = [];
    const portrait = () => turned.push('portrait') && 1;
    const android = await helperFor('running', undefined, { onAndroid: true, portrait });
    const ios = await helperFor('running', undefined, { onAndroid: false, portrait });
    try {
      expect(await android.ask('/portrait')).toEqual({ rotation: 1 });
      expect(await ios.ask('/portrait')).toEqual({ rotation: null });
      expect(turned).toEqual(['portrait']);
    } finally {
      android.server.close();
      ios.server.close();
    }
  });

  it('opens the bundler or a path under it, and refuses anything else', async () => {
    const { server, ask, ran } = await helperFor('running');
    try {
      expect(await ask('/open?path=%2F--%2Fevents%2F7')).toEqual({ opened: '/--/events/7' });
      expect(await ask('/open?path=')).toEqual({ opened: '' });
      expect(await ask('/open?path=https%3A%2F%2Fexample.com')).toEqual({
        error: 'open what? /open?path=/--/… gave https://example.com',
      });
      expect(ran).toEqual([
        expect.stringMatching(/^open exp:\/\/.+\/--\/events\/7$/),
        expect.stringMatching(/^open exp:\/\/[^/]+$/),
      ]);
    } finally {
      server.close();
    }
  });

  it('fails to open when am start refuses a later send', async () => {
    const refused = async (url) => {
      await new Promise((done) => setTimeout(done, 1));
      throw new Error(`could not open ${url}: Error: Activity not started`);
    };
    const { server, ask } = await helperFor('running', refused);
    try {
      expect(await ask('/open?path=%2F--%2Fevents%2F7')).toEqual({
        error: expect.stringMatching(/^could not open exp:\/\/.+\/--\/events\/7: Error/),
      });
    } finally {
      server.close();
    }
  });

  it('on Android, answers a reload once the app has run again', async () => {
    const { server, ask, ran } = await helperFor('running', undefined, {
      onAndroid: true,
      reload: async () => {
        ran.push('reload until run');
        return true;
      },
    });
    try {
      expect(await ask('/reload')).toEqual({ reloaded: true });
      expect(ran).toEqual(['reload until run']);
    } finally {
      server.close();
    }
  });

  it('on Android, says so when the app did not run again after a reload', async () => {
    const { server, ask } = await helperFor('running', undefined, {
      onAndroid: true,
      reload: async () => false,
    });
    try {
      expect(await ask('/reload')).toEqual({ reloaded: false });
    } finally {
      server.close();
    }
  });

  it('refuses a state it does not know', async () => {
    const { server, ask, ran } = await helperFor('running');
    try {
      expect(await ask('/api?to=gone')).toEqual({
        error: 'no API state gone: up, paused, stopped',
      });
      expect(ran).toEqual([]);
    } finally {
      server.close();
    }
  });

  it("switches the account's language", async () => {
    const { server, ask, languages } = await helperFor('running');
    try {
      expect(await ask('/language?to=es')).toEqual({ language: 'es' });
      expect(languages).toEqual(['es']);
    } finally {
      server.close();
    }
  });
  it('hands a membership change to the batch, once the API is up', async () => {
    const asked = [];
    const { server, ask } = await helperFor('running', undefined, {
      changeMembership: async (change, org) => {
        asked.push([change, org]);
        return { membership: change, org };
      },
    });
    try {
      expect(await ask('/membership?change=suspend&org=Alpha%20Hall')).toEqual({
        membership: 'suspend',
        org: 'Alpha Hall',
      });
      expect(asked).toEqual([['suspend', 'Alpha Hall']]);
    } finally {
      server.close();
    }
  });

  it('refuses a membership change in a batch that makes none', async () => {
    const { server, ask } = await helperFor('running');
    try {
      expect(await ask('/membership?change=pause&org=Alpha')).toEqual({
        error: 'this batch makes no membership change',
      });
    } finally {
      server.close();
    }
  });

  it('clears nothing for a flow run alone, so reset.yaml still runs outside a batch', async () => {
    const { server, ask } = await helperFor('running');
    try {
      expect(await ask('/membership?change=clear')).toEqual({ membership: 'clear' });
    } finally {
      server.close();
    }
  });
});

describe('a batch flow', () => {
  it('keeps the loaded bundle, signs in once, and runs every check in every language', () => {
    const flow = batchFlow({ checks: ['home', 'settings'], languages: ['en', 'es'], cold: false });
    expect(flow.match(/launchApp/g)).toHaveLength(1);
    expect(flow).toContain('stopApp: false');
    expect(flow.match(/session\.yaml/g)).toHaveLength(1);
    expect(flow.match(/optional: true/g)).toHaveLength(4);
    expect(flow.indexOf('_checks/settings.en.yaml')).toBeLessThan(flow.indexOf('/language?to=es'));
    expect(flow.indexOf('/language?to=es')).toBeLessThan(flow.indexOf('_checks/home.es.yaml'));
  });

  it('reloads first, so nothing the last run left open hides Home', () => {
    const flow = batchFlow({ checks: ['home'], languages: ['en'], cold: false });
    expect(flow.indexOf("ASK: '/reload'")).toBeGreaterThan(flow.indexOf('launchApp'));
    expect(flow.indexOf("ASK: '/reload'")).toBeLessThan(flow.indexOf('session.yaml'));
  });

  it('picks up after a crash in the language it stopped in', () => {
    const rest = batchRuns(['home', 'settings'], ['en', 'es']).slice(1);
    const flow = batchFlow({ runs: rest });
    expect(flow).not.toContain('_checks/home.en.yaml');
    expect(flow.match(/\/language\?to=/g)).toHaveLength(1);
    expect(flow.indexOf('_checks/settings.en.yaml')).toBeLessThan(flow.indexOf('/language?to=es'));
  });

  it('runs a check named twice twice, each under its own id', () => {
    const runs = batchRuns(['home', 'settings', 'home'], ['en']);
    expect(runs.map(runId)).toEqual(['home.en', 'settings.en', 'home.en.run2']);
    const flow = batchFlow({ runs });
    expect(flow).toContain('_checks/home.en.yaml');
    expect(flow).toContain('_checks/home.en.run2.yaml');
  });

  it('reports a failed first run of a check that passed the second time', () => {
    const ids = batchRuns(['home', 'home'], ['any']).map(runId);
    expect(batchSummary(ids, { passed: new Set(['home.run2']), begun: ids, crashed: [] })).toEqual([
      '✗ home',
      '✓ home.run2',
    ]);
  });

  it('relaunches and signs out first when it is one check, cold', () => {
    const flow = batchFlow({ checks: ['home'], languages: ['any'], cold: true });
    expect(flow).toContain('stopApp: true');
    expect(flow.indexOf('sign-out.yaml')).toBeLessThan(flow.indexOf('session.yaml'));
  });
});

describe('the batch command', () => {
  it('reads its name, checks, account and languages', () => {
    expect(
      parseBatch([
        'tour',
        'home',
        'settings',
        'EMAIL=a@b.test',
        'PASSWORD=x=y',
        '--lang',
        'en,es',
        '--ipad',
      ]),
    ).toEqual({
      name: 'tour',
      checks: ['home', 'settings'],
      languages: ['en', 'es'],
      vars: { EMAIL: 'a@b.test', PASSWORD: 'x=y' },
      cold: false,
    });
  });

  it("runs in the account's own language when none is named", () => {
    expect(parseBatch(['tour', 'home', '--cold']).languages).toEqual(['any']);
  });

  it('asks for a check', () => {
    expect(() => parseBatch(['tour', 'EMAIL=a@b.test'])).toThrow('which batch?');
  });

  it('re-runs every failed check on the same device in its own language', () => {
    const failures = [
      { check: 'settings', language: 'es' },
      { check: 'home', language: 'en' },
    ];
    expect(
      rerunHints('tour', failures, {
        args: ['--ipad', '--lang', 'en,es'],
        email: 'a@b.test',
        secret: 'S',
      }),
    ).toEqual([
      'node .qa/bin/qa-env.mjs batch tour-settings-es settings --lang es --cold --ipad EMAIL=a@b.test PASSWORD=… TOTP_SECRET=…',
      'node .qa/bin/qa-env.mjs batch tour-home-en home --lang en --cold --ipad EMAIL=a@b.test PASSWORD=… TOTP_SECRET=…',
    ]);
  });

  it('re-runs a failed check on the iPhone SE it ran on', () => {
    expect(
      rerunHints('tour', [{ check: 'home', language: 'any' }], {
        args: ['--se'],
        email: 'a@b.test',
        secret: null,
      }),
    ).toEqual([
      'node .qa/bin/qa-env.mjs batch tour-home home --cold --se EMAIL=a@b.test PASSWORD=…',
    ]);
  });

  it('re-runs a check that failed twice once', () => {
    const failures = batchRuns(['home', 'home'], ['any']);
    expect(rerunHints('tour', failures, { args: [], email: 'a@b.test', secret: null })).toEqual([
      'node .qa/bin/qa-env.mjs batch tour-home home --cold EMAIL=a@b.test PASSWORD=…',
    ]);
  });

  it("re-runs in the account's own language when the batch named none", () => {
    expect(
      rerunHints('tour', [{ check: 'home', language: 'any' }], {
        args: ['--android'],
        email: 'a@b.test',
        secret: null,
      }),
    ).toEqual([
      'node .qa/bin/qa-env.mjs batch tour-home home --cold --android EMAIL=a@b.test PASSWORD=…',
    ]);
  });

  it("keeps the batch's other variables, quoted for the shell", () => {
    expect(
      rerunHints('tour', [{ check: 'home', language: 'any' }], {
        args: [],
        email: 'a@b.test',
        secret: null,
        rest: { ORG_NAME: "Ana's Events", ROLE: 'admin' },
      }),
    ).toEqual([
      "node .qa/bin/qa-env.mjs batch tour-home home --cold EMAIL=a@b.test PASSWORD=… 'ORG_NAME=Ana'\\''s Events' ROLE=admin",
    ]);
  });
});

describe('Expo Go after a reload', () => {
  it('is running while launchd holds a process for it', () => {
    expect(
      expoGoRunning(
        '38266\t0\tUIKitApplication:dev.mobile.maestro-driver-iosUITests.xctrunner[2a09][rb-legacy]\n' +
          '36687\t0\tUIKitApplication:host.exp.Exponent[7164][rb-legacy]',
      ),
    ).toBe(true);
  });

  it('is closed when its entry has no process, or there is none', () => {
    expect(expoGoRunning('-\t-9\tUIKitApplication:host.exp.Exponent[7164][rb-legacy]')).toBe(false);
    expect(expoGoRunning('36010\t0\tUIKitApplication:com.apple.Spotlight[7454][rb-legacy]')).toBe(
      false,
    );
  });
});

describe('a batch with no bundler', () => {
  it('stops before any Maestro run, naming the port and how to start it', async () => {
    const asked = [];
    await expect(
      assertBundler({ port: 18081, command: bundlerCommand(false) }, async (port) => {
        asked.push(port);
        return false;
      }),
    ).rejects.toThrow('no bundler on 18081: start it with `node .qa/bin/qa-env.mjs ios`');
    expect(asked).toEqual([18081]);
  });

  it('names android as the way to start it for an Android batch', async () => {
    await expect(
      assertBundler({ port: 18081, command: bundlerCommand(true) }, async () => false),
    ).rejects.toThrow('no bundler on 18081: start it with `node .qa/bin/qa-env.mjs android`');
  });

  it('goes on when the bundler answers', async () => {
    await expect(
      assertBundler({ port: 18081, command: 'ios' }, async () => true),
    ).resolves.toBeUndefined();
  });
});

describe('the list a batch ends with', () => {
  it('names the bundler once when it went away and the batch stopped resuming', () => {
    expect(
      batchSummary(['home', 'settings', 'roles'], {
        passed: new Set(['home']),
        begun: ['home', 'settings'],
        crashed: ['settings'],
        bundlerGone: { port: 18081, command: 'ios' },
      }),
    ).toEqual([
      '✓ home',
      "✗ settings: Maestro's driver stopped answering (a driver crash)",
      '✗ roles: not run',
      'Stopped: no bundler on 18081: start it with `node .qa/bin/qa-env.mjs ios`',
    ]);
  });

  it('names the check the driver died in, and those it never reached', () => {
    expect(
      batchSummary(['home', 'settings', 'roles', 'members'], {
        passed: new Set(['home', 'members']),
        begun: ['home', 'settings', 'members'],
        crashed: ['settings'],
      }),
    ).toEqual([
      '✓ home',
      "✗ settings: Maestro's driver stopped answering (a driver crash)",
      '✗ roles: not run',
      '✓ members',
    ]);
  });

  it('says why no check ran when the driver was lost while signing in', () => {
    expect(
      batchSummary(['home', 'settings'], {
        passed: new Set(),
        begun: [],
        crashed: [],
        unstarted: new Map([
          ['home', 'stalled'],
          ['settings', 'ended'],
        ]),
      }),
    ).toEqual([
      "✗ home: not run: Maestro's driver stopped answering before the first check, while signing in",
      '✗ settings: not run: Maestro ended before the first check, while signing in (its output says why)',
    ]);
  });
});

describe('the driver a frozen run leaves on the simulator', () => {
  it('is found by its pid, and no other app is', () => {
    expect(
      driverPids(
        '38266\t0\tUIKitApplication:dev.mobile.maestro-driver-iosUITests.xctrunner[2a09][rb-legacy]\n' +
          '36010\t0\tUIKitApplication:host.exp.Exponent[7454][rb-legacy]\n' +
          '-\t-9\tUIKitApplication:dev.mobile.maestro-driver-iosUITests.xctrunner[1b02][rb-legacy]',
      ),
    ).toEqual([38266]);
  });

  it("finds Maestro's xcodebuild for that simulator, and no other build", () => {
    expect(
      driverBuilds(
        '  4120 /usr/bin/xcodebuild test-without-building -xctestrun /tmp/maestro-driver-ios-config.xctestrun -destination id=SIM-1\n' +
          '  4121 /usr/bin/xcodebuild test-without-building -xctestrun /tmp/maestro-driver-ios-config.xctestrun -destination id=SIM-2\n' +
          '  4122 /usr/bin/xcodebuild -workspace Soirely.xcworkspace -destination id=SIM-1\n' +
          '  4123 /bin/zsh',
        'SIM-1',
      ),
    ).toEqual([4120]);
  });
});

describe('one Maestro run of a batch', () => {
  const held = ['home', 'settings'].map((check) => ({ check, language: 'any' }));
  const runOf = ({ checks, stalls }) => {
    const begun = [];
    const stops = [];
    const unstarted = new Map();
    const options = {
      begun,
      passed: new Set(),
      crashed: [],
      unstarted,
      heard: { at: 0 },
      device: 'SIM-1',
      onAndroid: false,
      run: async (stall) => {
        begun.push(...checks);
        stall.stalled = stalls;
      },
      stop: (device, onAndroid) => stops.push({ device, onAndroid, begun: begun.length }),
    };
    return { options, stops, unstarted };
  };

  it('stops the driver of a run the watchdog stopped, once and on its device, before resuming', async () => {
    const { options, stops } = runOf({ checks: ['home'], stalls: true });
    expect(await runHeld(held, options)).toEqual({ crashed: 'home', rest: held.slice(1) });
    expect(stops).toEqual([{ device: 'SIM-1', onAndroid: false, begun: 1 }]);
  });

  it('leaves the driver of a run that ended on its own', async () => {
    const { options, stops } = runOf({ checks: ['home'], stalls: false });
    await runHeld(held, options);
    expect(stops).toEqual([]);
  });

  it('starts nothing more until the stopped driver is gone', async () => {
    const { options } = runOf({ checks: ['home'], stalls: true });
    let gone = false;
    options.stop = async () => {
      await new Promise((wait) => setTimeout(wait, 10));
      gone = true;
    };
    await runHeld(held, options);
    expect(gone).toBe(true);
  });

  it('resumes again after a stall when the resume ends before its first check', async () => {
    const watchdog = { stopped: false };
    const stalled = runOf({ checks: ['home'], stalls: true });
    await runHeld(held, { ...stalled.options, watchdog });

    const ended = runOf({ checks: [], stalls: false });
    const rest = held.slice(1);
    expect(await runHeld(rest, { ...ended.options, watchdog })).toEqual({ crashed: null, rest });
    expect([...ended.unstarted.values()]).toEqual(['ended']);
  });

  it('says whether a run lost before its first check stalled or ended', async () => {
    const stalled = runOf({ checks: [], stalls: true });
    expect(await runHeld(held, stalled.options)).toEqual({ crashed: null, rest: held });
    expect([...stalled.unstarted.values()]).toEqual(['stalled', 'stalled']);

    const ended = runOf({ checks: [], stalls: false });
    expect(await runHeld(held, ended.options)).toEqual({ crashed: null, rest: [] });
    expect([...ended.unstarted.values()]).toEqual(['ended', 'ended']);
  });
});

describe('what a Maestro run that lost its driver leaves to resume', () => {
  const runs = ['home', 'settings', 'roles', 'members'].map((check) => ({
    check,
    language: 'any',
  }));

  it('blames the check the driver died in and resumes past it', () => {
    expect(
      afterRun(runs, { begun: ['home', 'settings'], from: 0, passed: new Set(['home']) }),
    ).toEqual({ crashed: 'settings', rest: runs.slice(2) });
  });

  it('resumes past a check that passed before the driver died, blaming nobody', () => {
    expect(
      afterRun(runs, {
        begun: ['home', 'settings'],
        from: 0,
        passed: new Set(['home', 'settings']),
      }),
    ).toEqual({ crashed: null, rest: runs.slice(2) });
  });

  it('stops when a resumed run reaches no new check, blaming nobody', () => {
    expect(
      afterRun(runs.slice(2), { begun: ['home', 'settings'], from: 2, passed: new Set(['home']) }),
    ).toEqual({ crashed: null, rest: [] });
  });

  it('resumes nothing after a run that reached its last check, even one that failed', () => {
    expect(
      afterRun(runs, {
        begun: ['home', 'settings', 'roles', 'members'],
        from: 0,
        passed: new Set(['home']),
      }),
    ).toEqual({ crashed: null, rest: [] });
  });

  it('lists a cold check that failed on its own as a plain failure, not a crash', () => {
    expect(
      afterRun([runs[1]], { begun: ['home', 'settings'], from: 1, passed: new Set(['home']) }),
    ).toEqual({ crashed: null, rest: [] });
  });

  it('blames the last check of a run the watchdog stopped, resuming nothing', () => {
    expect(
      afterRun(runs, {
        begun: ['home', 'settings', 'roles', 'members'],
        from: 0,
        passed: new Set(['home']),
        stalled: true,
      }),
    ).toEqual({ crashed: 'members', rest: [] });
  });

  it('resumes every check of a run the watchdog stopped before its first', () => {
    expect(afterRun(runs, { begun: [], from: 0, passed: new Set(), stalled: true })).toEqual({
      crashed: null,
      rest: runs,
    });
  });

  it('resumes every check of a run that ended before its first, once the watchdog has stopped one', () => {
    expect(afterRun(runs, { begun: [], from: 0, passed: new Set(), afterStall: true })).toEqual({
      crashed: null,
      rest: runs,
    });
  });

  it('stops resuming after the cap when every resume crashes on the same check', async () => {
    let resumes = 0;
    await resumeBatch(
      runs,
      async (rest) => {
        resumes++;
        return { rest: resumes > 20 ? [] : rest };
      },
      { bundler: async () => true },
    );
    expect(resumes).toBe(MAX_RESUMES);
  });

  it('stops resuming once a resume leaves nothing to run', async () => {
    let resumes = 0;
    await resumeBatch(
      runs,
      async () => {
        resumes++;
        return { rest: [] };
      },
      { bundler: async () => true },
    );
    expect(resumes).toBe(1);
  });

  it('makes no further resume once the bundler has gone, and says so', async () => {
    let resumes = 0;
    const answers = [true, false];
    const resumed = await resumeBatch(
      runs,
      async (rest) => {
        resumes++;
        return { rest };
      },
      { bundler: async () => answers.shift() },
    );
    expect(resumes).toBe(1);
    expect(resumed).toEqual({ bundlerGone: true });
  });

  it('starts no resume when the bundler is gone after the first run', async () => {
    let resumes = 0;
    const resumed = await resumeBatch(
      runs,
      async (rest) => {
        resumes++;
        return { rest };
      },
      { bundler: async () => false },
    );
    expect(resumes).toBe(0);
    expect(resumed).toEqual({ bundlerGone: true });
  });
});

describe('a cold batch whose bundler goes away', () => {
  it('runs no further check once the bundler has gone, and says so', async () => {
    const ran = [];
    const answers = [true, false];
    const cold = await coldBatch(['home', 'settings', 'roles'], async (run) => ran.push(run), {
      bundler: async () => answers.shift(),
    });
    expect(ran).toEqual(['home']);
    expect(cold).toEqual({ bundlerGone: true });
  });

  it('runs every check while the bundler answers', async () => {
    const ran = [];
    const cold = await coldBatch(['home', 'settings'], async (run) => ran.push(run), {
      bundler: async () => true,
    });
    expect(ran).toEqual(['home', 'settings']);
    expect(cold).toEqual({ bundlerGone: false });
  });
});

describe('the time a Maestro run is given', () => {
  it('grows with its checks, and stops a hung single check within minutes', () => {
    expect(runBudgetMs(1)).toBe(7 * 60_000);
    expect(runBudgetMs(10)).toBeGreaterThan(runBudgetMs(1));
    expect(runBudgetMs(10)).toBeLessThan(47 * 60_000);
  });

  it('stops a run that never exits once its budget is spent', async () => {
    const started = Date.now();
    const ok = await runAsync(process.execPath, ['-e', 'setInterval(() => {}, 1e3)'], {
      timeoutMs: 300,
    });
    expect(ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('stops a run that has stopped reaching the harness, long before its budget', async () => {
    const stall = { ms: 300, heard: { at: Date.now() } };
    const ok = await runAsync(process.execPath, ['-e', 'setInterval(() => {}, 1e3)'], {
      timeoutMs: 60_000,
      stall,
    });
    expect(ok).toBe(false);
    expect(stall.stalled).toBe(true);
  });

  it('leaves a run alone while it keeps reaching the harness', async () => {
    const stall = { ms: 300, heard: { at: Date.now() } };
    const beat = setInterval(() => (stall.heard.at = Date.now()), 50);
    const ok = await runAsync(process.execPath, ['-e', 'setTimeout(() => {}, 1_000)'], { stall });
    clearInterval(beat);
    expect(ok).toBe(true);
    expect(stall.stalled).toBeUndefined();
  });
});

describe('the flows a batch runs', () => {
  it("composes the repository's checks in all four languages", () => {
    const root = join(import.meta.dirname, '..');
    const dir = join(root, 'apps/mobile/src/i18n/locales');
    const catalogues = Object.fromEntries(
      ['en', 'es', 'fr', 'pt'].map((code) => [
        code,
        JSON.parse(readFileSync(join(dir, `${code}.json`), 'utf8')),
      ]),
    );
    const source = join(root, 'apps/mobile/.maestro');
    const checks = readdirSync(join(source, 'checks'))
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => file.slice(0, -'.yaml'.length));
    const target = mkdtempSync(join(tmpdir(), 'qa-batch-'));
    try {
      composeBatch(source, target, {
        checks,
        languages: ['en', 'es', 'fr', 'pt'],
        cold: false,
        catalogues,
        email: 'qa@soirely.test',
        onAndroid: false,
      });
      expect(readFileSync(join(target, '_checks/settings.es.yaml'), 'utf8')).toContain(
        "'Configuración'",
      );
      expect(readFileSync(join(target, '_checks/security.es.yaml'), 'utf8')).toContain(
        "'Seguridad'",
      );
      expect(readFileSync(join(target, '_checks/sign-in-rules.fr.yaml'), 'utf8')).toContain(
        "'Règles de connexion|Règles de connexion de .*'",
      );
      expect(readFileSync(join(target, '_checks/sc23267-start-cold.fr.yaml'), 'utf8')).toContain(
        'file: sc23267-start-cold.fr.sc23267-start-cold-once.flow.yaml',
      );
      expect(
        existsSync(join(target, '_checks/sc23267-start-cold.fr.sc23267-start-cold-once.flow.yaml')),
      ).toBe(true);
      const session = readFileSync(join(target, 'batch/session.yaml'), 'utf8');
      expect(session).not.toContain('{{t:');
      const signedIn = new RegExp(
        `^(?:${[...session.matchAll(/notVisible: '(.*)'/g)].at(-1)[1].replaceAll("''", "'")})$`,
      );
      for (const code of ['en', 'es', 'fr', 'pt']) {
        for (const line of [
          catalogues[code].settings.signedInAs,
          catalogues[code].noOrganisation.signedInAs,
        ]) {
          expect(line.replace('{{email}}', 'qa@soirely.test')).toMatch(signedIn);
          expect(line.replace('{{email}}', 'other@soirely.test')).not.toMatch(signedIn);
        }
      }
      const signOut = readFileSync(join(target, 'batch/sign-out.yaml'), 'utf8');
      const someoneSignedIn = new RegExp(
        `^(?:${signOut.match(/when:\s+visible: '(.*)'\s+commands:/)[1].replaceAll("''", "'")})$`,
      );
      const homeSettled = new RegExp(
        `^(?:${signOut.match(/extendedWaitUntil:\s+visible: '(.*)'/)[1].replaceAll("''", "'")})$`,
      );
      for (const code of ['en', 'es', 'fr', 'pt']) {
        for (const line of [
          catalogues[code].settings.signedInAs,
          catalogues[code].noOrganisation.signedInAs,
        ]) {
          expect(line.replace('{{email}}', 'other@soirely.test')).toMatch(homeSettled);
          expect(line.replace('{{email}}', 'other@soirely.test')).toMatch(someoneSignedIn);
        }
        expect(catalogues[code].steps.organisationTitle).toMatch(homeSettled);
      }
      const onDetails = new RegExp(
        `^(?:${signOut.match(/when:\s+visible: '(.*)'\s+file: \.\.\/sign-out-from-complete-profile\.yaml/)[1].replaceAll("''", "'")})$`,
      );
      for (const code of ['en', 'es', 'fr', 'pt']) {
        expect(catalogues[code].steps.organisationTitle).toMatch(onDetails);
        expect(catalogues[code].steps.organisationTitle).not.toMatch(someoneSignedIn);
      }
      const detailsAt = signOut.indexOf('file: ../sign-out-from-complete-profile.yaml');
      expect(detailsAt).toBeGreaterThan(-1);
      expect(detailsAt).toBeLessThan(signOut.indexOf('openLink: ${METRO_URL}/--/settings'));
      expect(existsSync(join(target, 'sign-out-from-complete-profile.yaml'))).toBe(true);
      expect(readFileSync(join(target, 'batch/reopen.yaml'), 'utf8')).not.toContain('{{t:');
      const sheet = "'This is the developer menu.*'";
      const decision = readFileSync(join(target, 'developer-menu-sheet.yaml'), 'utf8');
      expect(decision.match(/when:\s+(?:not)?[vV]isible: .*/g)).toEqual([
        `when:\n      notVisible: ${sheet}`,
      ]);
      expect(decision).toMatch(
        /true: \$\{output\.developerMenuSheet\}\s+commands:\s+- tapOn: 'Continue'/,
      );
      expect(decision).not.toMatch(/copyTextFrom|SCREENS|point:/);
      expect(decision).toMatch(/- tapOn: 'Continue'[\s\S]*file: developer-menu-close\.yaml\n/);
      const close = readFileSync(join(target, 'developer-menu-close.yaml'), 'utf8');
      expect(close).toMatch(/visible: 'Go home'\s+commands:\s+- tapOn: 'Close'/);
      expect(close).toMatch(/notVisible: 'Go home'/);
      expect(close).not.toContain('point:');
      const menu = readFileSync(join(target, 'expo-go-menu.yaml'), 'utf8');
      expect(menu).toContain('file: developer-menu-close.yaml');
      expect(menu).not.toMatch(/point:|tapOn/);
      expect(readFileSync(join(target, 'batch/developer-menu.yaml'), 'utf8')).toContain(
        "visible: '${SETTLED}|This is the developer menu.*'",
      );
      for (const flow of ['batch/developer-menu.yaml', 'expo-go-menu.yaml']) {
        const text = readFileSync(join(target, flow), 'utf8');
        expect(text).toMatch(/file: (\.\.\/)?developer-menu-sheet\.yaml\n/);
        expect(text).not.toContain(sheet);
      }
      expect(readFileSync(join(target, 'batch/developer-menu.yaml'), 'utf8')).not.toMatch(
        /when:\s+(not)?[vV]isible/,
      );
      const settled = (flow) =>
        new RegExp(
          `^(?:${readFileSync(join(target, `batch/${flow}.yaml`), 'utf8')
            .match(/file: developer-menu\.yaml\s+env:\s+SETTLED: '(.*)'/)[1]
            .replaceAll("''", "'")})$`,
        );
      for (const flow of ['session', 'sign-out', 'reopen']) {
        for (const code of ['en', 'es', 'fr', 'pt']) {
          expect(catalogues[code].signIn.title).toMatch(settled(flow));
        }
      }
      for (const flow of ['session', 'sign-out', 'reopen', 'reset']) {
        for (const code of ['en', 'es', 'fr', 'pt']) {
          expect(catalogues[code].todayScreen.tab.today).toMatch(settled(flow));
        }
      }
      for (const code of ['en', 'es', 'fr', 'pt']) {
        expect(catalogues[code].todayScreen.tab.today).toMatch(someoneSignedIn);
      }
      for (const flow of ['session', 'sign-in-form']) {
        const toSettings = new RegExp(
          `^(?:${readFileSync(join(target, `batch/${flow}.yaml`), 'utf8')
            .match(/when:\s+visible: '(.*)'\s+file: to-settings\.yaml/)[1]
            .replaceAll("''", "'")})$`,
        );
        for (const code of ['en', 'es', 'fr', 'pt']) {
          expect(catalogues[code].todayScreen.tab.today).toMatch(toSettings);
        }
      }
      const upright = readFileSync(join(target, 'batch/session.yaml'), 'utf8');
      expect(upright.indexOf('setOrientation: PORTRAIT')).toBeGreaterThan(-1);
      expect(upright.indexOf('ASK: /portrait')).toBeGreaterThan(
        upright.indexOf('setOrientation: PORTRAIT'),
      );
      expect(upright.indexOf('ASK: /portrait')).toBeLessThan(
        upright.indexOf('file: to-settings.yaml'),
      );
      const reset = readFileSync(join(target, 'batch/reset.yaml'), 'utf8');
      expect(reset.match(/file: developer-menu\.yaml\s+env:\s+SETTLED: '(.*)'/)[1]).toBe(
        reset.match(/notVisible: '(.*)'/)[1],
      );
      expect(reset).toContain('ASK: /running');
      expect(reset).toMatch(
        /ASK: \/reload(?:\s|#.*)+- runFlow:\s+when:\s+true: \$\{!output\.helper\.reloaded\}\s+file: reopen\.yaml[\s\S]*openLink: \$\{METRO_URL\}\/--\//,
      );
      expect(reset).not.toMatch(/when:\s+(not)?[vV]isible/);
      expect(readdirSync(join(target, 'batch')).filter((f) => f.includes('save-password'))).toEqual(
        [],
      );
      expect(readFileSync(join(target, 'sign-in.yaml'), 'utf8')).toContain('stopApp: true');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('a check that runs a sibling check', () => {
  it('carries the sibling into _checks, so its runFlow resolves without naming it', () => {
    const source = mkdtempSync(join(tmpdir(), 'qa-source-'));
    const target = mkdtempSync(join(tmpdir(), 'qa-batch-'));
    mkdirSync(join(source, 'checks'));
    writeFileSync(
      join(source, 'checks', 'outer.yaml'),
      "appId: x\n---\n- runFlow:\n    file: once.yaml\n    env:\n      RUN: '1'\n- runFlow: once.yaml\n",
    );
    writeFileSync(
      join(source, 'checks', 'once.yaml'),
      "appId: x\n---\n- tapOn: '{{t:hello}}'\n- takeScreenshot: shot-${RUN}\n- runFlow: inner.yaml\n",
    );
    writeFileSync(join(source, 'checks', 'inner.yaml'), "appId: x\n---\n- tapOn: '{{t:hello}}'\n");
    try {
      composeBatch(source, target, {
        checks: ['outer'],
        languages: ['en', 'es'],
        cold: false,
        catalogues: { en: { hello: 'Hello' }, es: { hello: 'Hola' } },
        email: 'qa@soirely.test',
        onAndroid: false,
      });
      const checks = join(target, '_checks');
      expect(readdirSync(checks).sort()).toEqual([
        'outer.en.once.flow.yaml',
        'outer.en.once.inner.flow.yaml',
        'outer.en.yaml',
        'outer.es.once.flow.yaml',
        'outer.es.once.inner.flow.yaml',
        'outer.es.yaml',
      ]);
      const outer = readFileSync(join(checks, 'outer.es.yaml'), 'utf8');
      expect(outer).toContain('    file: outer.es.once.flow.yaml\n');
      expect(outer).toContain('- runFlow: outer.es.once.flow.yaml\n');
      expect(outer).not.toMatch(/once\.yaml/);
      const once = readFileSync(join(checks, 'outer.es.once.flow.yaml'), 'utf8');
      expect(once).toContain("'Hola'");
      expect(once).toContain('- runFlow: outer.es.once.inner.flow.yaml');
      expect(once).not.toContain('ASK:');
      expect(once).toContain('- takeScreenshot: outer.es.once-shot-${RUN}\n');
      expect(readFileSync(join(checks, 'outer.en.once.flow.yaml'), 'utf8')).toContain(
        '- takeScreenshot: outer.en.once-shot-${RUN}\n',
      );
      expect(readFileSync(join(checks, 'outer.en.once.inner.flow.yaml'), 'utf8')).toContain(
        "'Hello'",
      );
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('keeps a sibling that is also named as a check apart from its run', () => {
    const source = mkdtempSync(join(tmpdir(), 'qa-source-'));
    const target = mkdtempSync(join(tmpdir(), 'qa-batch-'));
    mkdirSync(join(source, 'checks'));
    writeFileSync(join(source, 'checks', 'outer.yaml'), 'appId: x\n---\n- runFlow: once.yaml\n');
    writeFileSync(join(source, 'checks', 'once.yaml'), 'appId: x\n---\n- takeScreenshot: shot\n');
    try {
      composeBatch(source, target, {
        checks: ['outer', 'once'],
        languages: ['es'],
        cold: false,
        catalogues: { es: {} },
        email: 'qa@soirely.test',
        onAndroid: false,
      });
      const checks = join(target, '_checks');
      expect(readdirSync(checks).sort()).toEqual([
        'once.es.yaml',
        'outer.es.once.flow.yaml',
        'outer.es.yaml',
      ]);
      expect(readFileSync(join(checks, 'once.es.yaml'), 'utf8')).toContain('ASK:');
      expect(readFileSync(join(checks, 'outer.es.once.flow.yaml'), 'utf8')).not.toContain('ASK:');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });
  it('gives each run of a repeated check its own copy of the sibling', () => {
    const source = mkdtempSync(join(tmpdir(), 'qa-source-'));
    const target = mkdtempSync(join(tmpdir(), 'qa-batch-'));
    mkdirSync(join(source, 'checks'));
    writeFileSync(join(source, 'checks', 'outer.yaml'), 'appId: x\n---\n- runFlow: once.yaml\n');
    writeFileSync(join(source, 'checks', 'once.yaml'), 'appId: x\n---\n- takeScreenshot: shot\n');
    try {
      composeBatch(source, target, {
        checks: ['outer', 'outer'],
        languages: ['es'],
        cold: false,
        catalogues: { es: {} },
        email: 'qa@soirely.test',
        onAndroid: false,
      });
      const checks = join(target, '_checks');
      expect(readFileSync(join(checks, 'outer.es.yaml'), 'utf8')).toContain(
        '- runFlow: outer.es.once.flow.yaml\n',
      );
      expect(readFileSync(join(checks, 'outer.es.run2.yaml'), 'utf8')).toContain(
        '- runFlow: outer.es.run2.once.flow.yaml\n',
      );
      expect(readFileSync(join(checks, 'outer.es.once.flow.yaml'), 'utf8')).toContain(
        '- takeScreenshot: outer.es.once-shot',
      );
      expect(readFileSync(join(checks, 'outer.es.run2.once.flow.yaml'), 'utf8')).toContain(
        '- takeScreenshot: outer.es.run2.once-shot',
      );
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('names the cycle when two checks run each other', () => {
    const source = mkdtempSync(join(tmpdir(), 'qa-source-'));
    const target = mkdtempSync(join(tmpdir(), 'qa-batch-'));
    mkdirSync(join(source, 'checks'));
    writeFileSync(join(source, 'checks', 'a.yaml'), 'appId: x\n---\n- runFlow: b.yaml\n');
    writeFileSync(join(source, 'checks', 'b.yaml'), 'appId: x\n---\n- runFlow: a.yaml\n');
    try {
      expect(() =>
        composeBatch(source, target, {
          checks: ['a'],
          languages: ['es'],
          cold: false,
          catalogues: { es: {} },
          email: 'qa@soirely.test',
          onAndroid: false,
        }),
      ).toThrow('a → b → a: a check runs itself');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('the harness in .qa/bin', () => {
  it('imports nothing from beside itself, so a copy refreshed alone runs', () => {
    const source = readFileSync(join(import.meta.dirname, 'qa-env.mjs'), 'utf8');
    expect([...source.matchAll(/from '\.{1,2}\/[^']+'/g)]).toEqual([]);
  });

  it('runs from a copy alone in a folder', () => {
    const bin = mkdtempSync(join(tmpdir(), 'qa-bin-'));
    writeFileSync(join(bin, 'qa-env.mjs'), readFileSync(join(import.meta.dirname, 'qa-env.mjs')));
    return expect(import(join(bin, 'qa-env.mjs'))).resolves.toHaveProperty('databaseCommands');
  });

  it('removes a worker the checked-out compose.yaml no longer names', () => {
    expect(REBUILD).toContain('--remove-orphans');
  });
});

describe('the dependencies, from a checkout', () => {
  it('clears the api cache after both installs', () => {
    const steps = dependencySteps(false, false);
    expect(steps.at(-1)).toBe('clearApiCache');
    expect(steps.slice(0, -1).map((entry) => entry.run[0])).toEqual(['npm', 'node']);
  });

  it('still clears it when neither lockfile changed', () => {
    expect(dependencySteps(true, true)).toEqual([
      { step: 'Node dependencies', run: null },
      { step: 'PHP dependencies', run: null },
      'clearApiCache',
    ]);
  });
});

describe('the database, from a checkout', () => {
  const console_ = ['console'];
  const verbs = (commands) => commands.map((args) => args.slice(0, 2).join(' '));
  const testDatabase = [
    'console doctrine:database:drop',
    'console doctrine:database:create',
    'console doctrine:migrations:migrate',
  ];

  it('stops the worker before the drop and recreates it after migrating', () => {
    expect(verbs(databaseCommands(console_, ['notification-worker'], false))).toEqual([
      'compose stop',
      'console doctrine:database:drop',
      'console doctrine:database:create',
      'console doctrine:migrations:migrate',
      'compose up',
      ...testDatabase,
    ]);
  });

  it('keeps the data, and still recreates the worker after migrating', () => {
    expect(verbs(databaseCommands(console_, ['notification-worker'], true))).toEqual([
      'console doctrine:migrations:migrate',
      'compose up',
      ...testDatabase,
    ]);
  });

  it('touches no service on a commit with nothing waiting for migrations', () => {
    const commands = databaseCommands(console_, [], false);
    expect(commands.filter(([first]) => first === 'compose')).toEqual([]);
    expect(commands).toHaveLength(6);
  });

  it('rebuilds the test database from nothing, even keeping the data', () => {
    for (const keepData of [false, true]) {
      const test = databaseCommands(console_, [], keepData).filter((args) =>
        args.includes('--env=test'),
      );
      expect(verbs(test)).toEqual(testDatabase);
    }
  });
});

describe('renewingSession', () => {
  const refused = () => Object.assign(new Error('answered 401'), { status: 401 });
  const tokens = (n) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}` });

  it('signs in once and reuses the token while it is accepted', async () => {
    let opened = 0;
    const session = renewingSession({
      open: async () => tokens(++opened),
      refresh: async () => {},
    });
    await session(async (token) => token);
    expect(await session(async (token) => token)).toBe('access-1');
    expect(opened).toBe(1);
  });

  it('renews with the refresh token on a 401 and asks once more', async () => {
    const presented = [];
    const session = renewingSession({
      open: async () => tokens(1),
      refresh: async (refreshToken) => (presented.push(refreshToken), tokens(2)),
    });
    await session(async (token) => token);
    const answer = await session(async (token) => {
      if (token === 'access-1') throw refused();
      return token;
    });
    expect(answer).toBe('access-2');
    expect(presented).toEqual(['refresh-1']);
  });

  it('signs in again when the refresh is refused', async () => {
    let opened = 0;
    const session = renewingSession({
      open: async () => tokens(++opened),
      refresh: async () => {
        throw refused();
      },
    });
    const answer = await session(async (token) => {
      if (token === 'access-1') throw refused();
      return token;
    });
    expect(answer).toBe('access-2');
  });

  it('shares one renewal between calls refused at the same time', async () => {
    let refreshed = 0;
    const session = renewingSession({
      open: async () => tokens(1),
      refresh: async () => (refreshed++, tokens(2)),
    });
    const call = () =>
      session(async (token) => {
        if (token === 'access-1') throw refused();
        return token;
      });
    expect(await Promise.all([call(), call()])).toEqual(['access-2', 'access-2']);
    expect(refreshed).toBe(1);
  });

  it('signs in fresh on the next call when a renewal fails', async () => {
    let opened = 0;
    const session = renewingSession({
      open: async () => {
        opened += 1;
        if (opened === 2) throw new Error('network blip');
        return tokens(opened);
      },
      refresh: async () => {
        throw refused();
      },
    });
    const call = () =>
      session(async (token) => {
        if (token === 'access-1') throw refused();
        return token;
      });
    await expect(call()).rejects.toThrow('network blip');
    expect(await call()).toBe('access-3');
  });

  it('signs in again for a call refused after another renewal failed', async () => {
    let opened = 0;
    const session = renewingSession({
      open: async () => {
        opened += 1;
        if (opened === 2) throw new Error('network blip');
        return tokens(opened);
      },
      refresh: async () => {
        throw refused();
      },
    });
    let answerSecond;
    const secondAnswered = new Promise((resolve) => (answerSecond = resolve));
    const first = session(async (token) => {
      if (token === 'access-1') throw refused();
      return token;
    });
    const second = session(async (token) => {
      if (token === 'access-1') {
        await secondAnswered;
        throw refused();
      }
      return token;
    });
    await expect(first).rejects.toThrow('network blip');
    answerSecond();
    expect(await second).toBe('access-3');
  });

  it('signs in again on the next call when the first sign-in fails', async () => {
    let opened = 0;
    const session = renewingSession({
      open: async () => {
        opened += 1;
        if (opened === 1) throw new Error('network blip');
        return tokens(opened);
      },
      refresh: async () => {},
    });
    await expect(session(async (token) => token)).rejects.toThrow('network blip');
    expect(await session(async (token) => token)).toBe('access-2');
  });

  it('passes any other failure through', async () => {
    const session = renewingSession({ open: async () => tokens(1), refresh: async () => {} });
    const broken = Object.assign(new Error('answered 500'), { status: 500 });
    await expect(
      session(async () => {
        throw broken;
      }),
    ).rejects.toBe(broken);
  });
});

describe('the account --ready reports', () => {
  const made = { email: 'a@qa.test', password: 'pw', accessToken: 'tok', sessionId: 'sess' };

  it('names the session it signed in with', () => {
    const report = readyReport({ ...made, secret: null });

    expect(report).toMatch(/accessToken {2}tok\n/);
    expect(report).toMatch(/sessionId {4}sess\n/);
    expect(report).not.toContain('TOTP_SECRET');
  });

  it('adds the two-factor secret when it turned two-factor on', () => {
    const report = readyReport({ ...made, secret: 'S3CR3T' });

    expect(report).toContain('two-factor on');
    expect(report).toContain('TOTP_SECRET  S3CR3T');
    expect(report).toContain('EMAIL=a@qa.test PASSWORD=pw TOTP_SECRET=S3CR3T');
  });
});

function mp4Header(size, type) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(size, 0);
  header.write(type, 4);
  return header;
}

describe('the API taken from the device', () => {
  it('removes only its own reverse for the moves, and puts it back after', async () => {
    const ran = [];
    const adb = (args) => ran.push(args.join(' '));
    await withoutReverse(18080, adb, async () => ran.push('moves'));
    expect(ran).toEqual(['reverse --remove tcp:18080', 'moves', 'reverse tcp:18080 tcp:18080']);
  });

  it('puts the reverse back when the moves fail', async () => {
    const ran = [];
    const adb = (args) => ran.push(args.join(' '));
    await expect(
      withoutReverse(18080, adb, async () => {
        throw new Error('pause failed');
      }),
    ).rejects.toThrow('pause failed');
    expect(ran).toEqual(['reverse --remove tcp:18080', 'reverse tcp:18080 tcp:18080']);
  });
});

describe('a membership change a check asks for', () => {
  const MEMBERSHIP = '01a1ae45-86aa-7b0a-b43c-1524b2b5e0ab';
  const changesFor = () => {
    const calls = [];
    const statements = [];
    let made = 0;
    let owners = 0;
    let refusing = false;
    const invited = [];
    const ownerNumbered =
      (n) =>
      async (path, options = {}) => {
        calls.push(`owner${n === 1 ? '' : `-${n}`} ${options.method ?? 'POST'} ${path}`);
        if (path === '/api/orgs' && options.method !== 'GET') {
          if (refusing) {
            refusing = false;
            throw Object.assign(new Error('Too many new organisations'), { status: 429 });
          }
          return { organisation: { id: `org-${++made}` } };
        }
        if (path.endsWith('/roles')) {
          return {
            roles: [
              { id: 'r-owner', seededAs: 'owner' },
              { id: 'r-administrator', seededAs: 'administrator' },
              { id: 'r-member', seededAs: 'member' },
            ],
          };
        }
        if (path.endsWith('/members/invite')) {
          invited.push(options.body.roleId);
          return { invitation: { id: `inv-${made}` } };
        }
        if (path.endsWith('/members') && options.method === 'GET') {
          return {
            members: [
              { id: 'other', user: { email: 'owner@soirely.test' } },
              { id: MEMBERSHIP, user: { email: 'qa@soirely.test' } },
            ],
          };
        }
        return null;
      };
    const change = membershipChanges({
      email: 'qa@soirely.test',
      member: async (path) => calls.push(`member ${path}`),
      ownerOf: async () => {
        owners += 1;
        return ownerNumbered(owners);
      },
      sql: async (statement) => statements.push(statement),
    });
    const refuseNextCreate = () => {
      refusing = true;
    };
    return { change, calls, statements, invited, owners: () => owners, refuseNextCreate };
  };

  it('makes the organisation and the batch account an administrator in it', async () => {
    const { change, calls, invited } = changesFor();
    expect(await change('join', 'Alpha Hall')).toEqual({
      membership: 'join',
      org: 'Alpha Hall',
      id: 'org-1',
    });
    expect(calls).toEqual([
      'owner POST /api/orgs',
      'owner GET /api/orgs/org-1/roles',
      'owner POST /api/orgs/org-1/members/invite',
      'member /api/invitations/inv-1/accept',
    ]);
    expect(invited).toEqual(['r-administrator']);
  });

  it('registers one owner for every organisation in the batch', async () => {
    const { change, owners } = changesFor();
    await change('join', 'Alpha Hall');
    await change('join', 'Bravo');
    expect(owners()).toBe(1);
  });

  it('suspends and removes the batch account through the API as the owner', async () => {
    const { change, calls } = changesFor();
    await change('join', 'Alpha Hall');
    calls.length = 0;
    await change('suspend', 'Alpha Hall');
    await change('remove', 'Alpha Hall');
    expect(calls).toEqual([
      'owner GET /api/orgs/org-1/members',
      `owner POST /api/orgs/org-1/members/${MEMBERSHIP}/suspend`,
      'owner GET /api/orgs/org-1/members',
      `owner DELETE /api/orgs/org-1/members/${MEMBERSHIP}`,
    ]);
  });

  it("pauses through the database, the batch account's membership only", async () => {
    const { change, statements } = changesFor();
    await change('join', 'Alpha Hall');
    await change('pause', 'Alpha Hall');
    expect(statements).toEqual([domainPause(MEMBERSHIP, 'qa@soirely.test')]);
    expect(statements[0]).toContain(`WHERE id = '${MEMBERSHIP}'`);
    expect(statements[0]).toContain("suspension = 'domain_closed'");
  });

  it('deletes the organisation it made, and a name joined again is a new one', async () => {
    const { change, calls } = changesFor();
    await change('join', 'Alpha Hall');
    await change('pause', 'Alpha Hall');
    calls.length = 0;
    await change('join', 'Alpha Hall');
    expect(calls.slice(0, 2)).toEqual(['owner DELETE /api/orgs/org-1', 'owner POST /api/orgs']);
    await change('delete', 'Alpha Hall');
    await expect(change('suspend', 'Alpha Hall')).rejects.toThrow('was not joined in this batch');
  });

  it('hands over to a new owner once one may make no more organisations', async () => {
    const { change, calls, owners, refuseNextCreate } = changesFor();
    await change('join', 'Alpha Hall');
    refuseNextCreate();
    await change('join', 'Bravo');
    expect(owners()).toBe(2);
    calls.length = 0;
    await change('suspend', 'Alpha Hall');
    await change('suspend', 'Bravo');
    expect(calls.filter((call) => call.includes('GET'))).toEqual([
      'owner GET /api/orgs/org-1/members',
      'owner-2 GET /api/orgs/org-2/members',
    ]);
  });

  it('clears every organisation the batch joined, and none twice', async () => {
    const { change, calls, owners } = changesFor();
    expect(await change('clear')).toEqual({ membership: 'clear' });
    expect(owners()).toBe(0);
    await change('join', 'Alpha Hall');
    await change('join', 'Bravo');
    await change('suspend', 'Alpha Hall');
    calls.length = 0;
    await change('clear');
    await change('clear');
    expect(calls).toEqual(['owner DELETE /api/orgs/org-1', 'owner DELETE /api/orgs/org-2']);
  });

  it('refuses a change it does not know, or one with no organisation', async () => {
    const { change } = changesFor();
    await expect(change('wipe', 'Alpha Hall')).rejects.toThrow('no membership change wipe');
    await expect(change('suspend', null)).rejects.toThrow('in which organisation?');
    await expect(change('remove', 'Nowhere')).rejects.toThrow('Nowhere was not joined');
  });

  it('writes no statement from an id or an address that is not one', () => {
    expect(() => domainPause("x'; DROP TABLE memberships; --", 'qa@soirely.test')).toThrow(
      'not a membership id',
    );
    expect(() => domainPause(MEMBERSHIP, "qa@x'; --")).toThrow('no domain');
  });
});

describe('waitForBoot', () => {
  const pause = async () => {};

  it('fails on the first pass after the emulator stops, with the reason', async () => {
    let passes = 0;
    const gone = () => (++passes > 2 ? 'the unit stopped' : null);
    await expect(
      waitForBoot({ name: 'qa_pixel', booted: () => false, gone, pause }),
    ).rejects.toThrow('qa_pixel: the unit stopped');
    expect(passes).toBe(3);
  });

  it('returns once the device reports booted while the emulator runs', async () => {
    let passes = 0;
    const booted = () => ++passes === 5;
    await waitForBoot({ name: 'qa_pixel', booted, gone: () => null, pause });
    expect(passes).toBe(5);
  });

  it('still gives up after its tries when the emulator neither boots nor stops', async () => {
    await expect(
      waitForBoot({ name: 'qa_pixel', booted: () => false, gone: () => null, pause, tries: 3 }),
    ).rejects.toThrow('qa_pixel did not boot within three minutes');
  });
});

describe('emulatorJournalArgs', () => {
  it('reads only the journal lines since this boot started', () => {
    expect(emulatorJournalArgs('soirely-qa-emulator', 1762500000)).toEqual([
      '--user',
      '-u',
      'soirely-qa-emulator',
      '--since=@1762500000',
      '-n',
      '20',
      '--no-pager',
    ]);
  });
});

describe('emulatorUnitGone', () => {
  const journal = () => 'emulator: core dumped';

  it('keeps waiting while the unit is active or activating', () => {
    expect(emulatorUnitGone('soirely-qa-emulator', 'active', journal)).toBeNull();
    expect(emulatorUnitGone('soirely-qa-emulator', 'activating', journal)).toBeNull();
  });

  it('names the unit and prints its journal once it has failed or been collected', () => {
    expect(emulatorUnitGone('soirely-qa-emulator', 'failed', journal)).toBe(
      'the emulator unit soirely-qa-emulator stopped (failed) before it booted:\nemulator: core dumped',
    );
    expect(emulatorUnitGone('soirely-qa-emulator', '', journal)).toContain('stopped (gone)');
  });
});

describe('missingCmdlineTools', () => {
  const message = missingCmdlineTools({
    sdk: '/sdk',
    avdmanager: '/sdk/cmdline-tools/latest/bin/avdmanager',
  });

  it('names the avdmanager path setup expected', () => {
    expect(message).toContain('/sdk/cmdline-tools/latest/bin/avdmanager');
  });

  it('gives both ways to install the tools and says to run setup again', () => {
    expect(message).toContain('Android SDK Command-line Tools (latest)');
    expect(message).toContain('/sdk/cmdline-tools/latest/bin');
    expect(message).toContain('developer.android.com/studio#command-tools');
    expect(message).toContain('run `node scripts/qa-env.mjs setup` again');
  });
});
