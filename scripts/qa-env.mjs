#!/usr/bin/env node
// A separate stack for QA. How to use it: .claude/skills/soirely-qa-tester, section 4.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import {
  copyFileSync,
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const DEVELOPMENT_PORTS = {
  POSTGRES_PORT: 5432,
  REDIS_PORT: 6379,
  MERCURE_PORT: 3000,
  API_PORT: 8080,
  WEB_PORT: 5173,
  MAILPIT_UI_PORT: 8025,
  MAILPIT_SMTP_PORT: 1025,
  SMOCKER_MOCK_PORT: 8086,
  SMOCKER_UI_PORT: 8088,
  OIDC_PORT: 8089,
  STORAGE_PORT: 4566,
  METRO_PORT: 8081,
  AGENT_GATEWAY_PORT: 8095,
};

export const TESTERS = [1, 2, 3];

// 127.0.0.1, not localhost: a cookie ignores the port, so a QA browser on localhost
// would overwrite a developer's session. One host for web and API keeps SameSite.
// A phone passes the machine's network address instead: on a phone, 127.0.0.1 is the phone.
// One compose project with every port moved up by offset. QA and the second developer use it.
export function stackConfig(project, offset, address = '127.0.0.1') {
  const HOST = `http://${address}`;
  const ports = Object.fromEntries(
    Object.entries(DEVELOPMENT_PORTS).map(([key, port]) => [key, port + offset]),
  );
  const urls = {
    api: `${HOST}:${ports.API_PORT}`,
    web: `${HOST}:${ports.WEB_PORT}`,
    mailpit: `${HOST}:${ports.MAILPIT_UI_PORT}`,
    smocker: `${HOST}:${ports.SMOCKER_UI_PORT}`,
    mercure: `${HOST}:${ports.MERCURE_PORT}/.well-known/mercure`,
    metro: `exp://${address}:${ports.METRO_PORT}`,
    oidc: `${HOST}:${ports.OIDC_PORT}`,
  };
  // The sandbox signs a token with the address it was reached at: this stack's port from a
  // browser or simulator, oidc:8080 from the API. The issuer lists accept both.
  const overrides = {
    COMPOSE_PROJECT_NAME: project,
    ...ports,
    MERCURE_PUBLIC_URL: urls.mercure,
    MERCURE_CORS_ORIGINS: `${urls.web} ${HOST}:${ports.METRO_PORT}`,
    STORAGE_PUBLIC_ENDPOINT: `${HOST}:${ports.STORAGE_PORT}`,
    OAUTH_GOOGLE_ISSUERS: `${urls.oidc}/google,http://oidc:8080/google`,
    OAUTH_APPLE_ISSUERS: `${urls.oidc}/apple,http://oidc:8080/apple,https://appleid.apple.com`,
    SOIRELY_GOOGLE_AUTHORIZE_URL: `${urls.oidc}/google/authorize`,
    SOIRELY_APPLE_AUTHORIZE_URL: `${urls.oidc}/apple/authorize`,
    OAUTH_APPLE_RETURN_URI: `${urls.api}/api/auth/oauth/apple/return`,
    SOIRELY_API_URL: urls.api,
    SOIRELY_MERCURE_URL: urls.mercure,
    CORS_WEB_ORIGIN: urls.web,
    CORS_EXPO_WEB_ORIGIN: `${HOST}:${ports.METRO_PORT}`,
    MAILPIT_URL: urls.mailpit,
  };
  // Expo reads these when the bundler starts, not from the stack's .env.
  const app = {
    EXPO_PUBLIC_API_URL: urls.api,
    EXPO_PUBLIC_GOOGLE_AUTHORIZE_URL: `${urls.oidc}/google/authorize`,
    EXPO_PUBLIC_GOOGLE_TOKEN_URL: `${urls.oidc}/google/token`,
    EXPO_PUBLIC_APPLE_AUTHORIZE_URL: `${urls.oidc}/apple/authorize`,
    EXPO_PUBLIC_APPLE_TOKEN_URL: `${urls.oidc}/apple/token`,
  };
  return { project, ports, urls, overrides, app };
}

// Tester n is its own compose project and worktree, soirely-qa<n>, with every port up n×10000.
export function qaConfig(tester = 1) {
  if (!TESTERS.includes(tester)) throw new Error(`no QA tester ${tester}: one of ${TESTERS}`);
  const { project, ports, urls, overrides, app } = stackConfig(
    tester === 1 ? 'soirely-qa' : `soirely-qa${tester}`,
    tester * 10000,
  );
  const label = tester === 1 ? 'Soirely QA' : `Soirely QA${tester}`;
  const simulators = {
    phone: { name: `${label} iPhone`, type: 'iPhone 17 Pro' },
    ipad: { name: `${label} iPad`, type: 'iPad Pro 13-inch (M5)' },
  };
  const avd = label.replace(/ /g, '_');
  const emulators = {
    phone: { name: `${avd}_Phone`, device: 'pixel_8' },
    tablet: { name: `${avd}_Tablet`, device: 'pixel_tablet' },
  };
  // Inside 5554–5584, the only consoles adb finds, and clear of 5554, where one started by hand lands.
  const emulatorPort = 5570 + 2 * tester;
  return {
    tester,
    project,
    ports,
    urls,
    overrides,
    app,
    simulators,
    emulators,
    emulatorPort,
    chromePort: 9221 + tester,
    // Maestro's iOS driver answers every run on its port; 22087, its default, is left to a run by hand.
    driverPort: 22087 + tester,
    helperPort: 22190 + tester,
  };
}

export const {
  project: COMPOSE_PROJECT,
  ports: QA_PORTS,
  urls: QA_URLS,
  overrides: QA_OVERRIDES,
  simulators: QA_SIMULATORS,
} = qaConfig(1);

const EXPO_GO = 'host.exp.Exponent';
const EXPO_GO_ANDROID = 'host.exp.exponent';
const ACCOUNT_ORGANISATION = 'QA Organisation';

export function renderQaEnv(
  example,
  overrides = QA_OVERRIDES,
  project = COMPOSE_PROJECT,
  heading = [
    '# Generated by scripts/qa-env.mjs on every checkout. Edits do not survive one.',
    `# A QA stack: compose project ${project}, with ports of its own.`,
  ],
) {
  const remaining = new Map(Object.entries(overrides));

  const lines = example.split('\n').map((line) => {
    const key = /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1];
    if (key === undefined || !remaining.has(key)) return line;
    const value = remaining.get(key);
    remaining.delete(key);
    return `${key}=${value}`;
  });

  const header = [...heading, ''];
  const appended = [...remaining].map(([key, value]) => `${key}=${value}`);
  const body = lines.join('\n').replace(/\n*$/, '\n');

  return [
    ...header,
    body,
    ...(appended.length ? ['# ── This stack only ──', ...appended, ''] : []),
  ].join('\n');
}

export function parseTarget(arg) {
  const value = (arg ?? 'main').trim();
  const pr = /^#?(\d+)$/.exec(value);
  if (pr) return { kind: 'pr', number: Number(pr[1]) };
  const story = /^sc-(\d+)$/i.exec(value);
  if (story) return { kind: 'story', id: `sc-${story[1]}` };
  return { kind: 'branch', name: value.replace(/^origin\//, '') };
}

// One of a tester's simulators runs at a time: the phone unless --ipad asks otherwise.
export function simulatorFor(args) {
  return args.includes('--ipad')
    ? { open: 'ipad', shut: 'phone' }
    : { open: 'phone', shut: 'ipad' };
}

export function emulatorFor(args) {
  return args.includes('--tablet')
    ? { open: 'tablet', shut: 'phone' }
    : { open: 'phone', shut: 'tablet' };
}

// An emulator's 127.0.0.1 is itself; reversed, these reach the host's, as on a simulator.
export function reversedPorts(ports) {
  const reached = [
    'METRO_PORT',
    'API_PORT',
    'OIDC_PORT',
    'MERCURE_PORT',
    'STORAGE_PORT',
    'MAILPIT_UI_PORT',
  ];
  return reached.map((key) => ports[key]);
}

export function androidSdk(env = process.env, platform = process.platform, home = homedir()) {
  return (
    env.ANDROID_HOME ??
    env.ANDROID_SDK_ROOT ??
    join(home, platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk')
  );
}

// Headless on Linux, the host GPU path goes through X's DRI3 and dumps core where that fails.
export function emulatorGpu(platform = process.platform, env = process.env) {
  return env.SOIRELY_QA_EMULATOR_GPU || (platform === 'linux' ? 'swangle_indirect' : 'host');
}

// The system image and the release APK both read this: an APK for another ABI is refused on install.
export function emulatorAbi(arch = process.arch) {
  return arch === 'arm64' ? 'arm64-v8a' : 'x86_64';
}

export function androidPackage(appConfig) {
  const id = /android:\s*\{\s*package:\s*'([^']+)'/.exec(appConfig)?.[1];
  if (!id) throw new Error('no android.package in apps/mobile/app.config.ts');
  return id;
}

export function releaseApk(root, sha) {
  return join(root, '.qa/release', `soirely-${sha.slice(0, 12)}.apk`);
}

export function releaseApp(root, sha) {
  return join(root, '.qa/release', `soirely-${sha.slice(0, 12)}.app`);
}

export function launchVideo(root, sha, platform, device) {
  return join(root, '.qa/release', `launch-${sha.slice(0, 12)}.${platform}.${device}.mp4`);
}

// A Mac keeps an APK and an app side by side: each build replaces only its own kind.
export function staleBuilds(names, build) {
  const kind = extname(build);
  return names.filter(
    (name) =>
      /^soirely-[0-9a-f]{12}\.(apk|app)$/.test(name) &&
      extname(name) === kind &&
      name !== basename(build),
  );
}

// On a Mac the simulator, as maestro does, unless --android asks for the emulator.
export function releasePlatform(args, platform = process.platform) {
  return platform === 'darwin' && !args.includes('--android') ? 'ios' : 'android';
}

export function simulatorArch(arch = process.arch) {
  return arch === 'arm64' ? 'arm64' : 'x86_64';
}

export function iosBundle(appConfig) {
  const id = /ios:\s*\{[^}]*bundleIdentifier:\s*'([^']+)'/.exec(appConfig)?.[1];
  if (!id) throw new Error('no ios.bundleIdentifier in apps/mobile/app.config.ts');
  return id;
}

export function xcodeWorkspace(names) {
  const found = names.filter((name) => name.endsWith('.xcworkspace'));
  if (found.length !== 1) {
    throw new Error(`expected one .xcworkspace in ios/, found ${found.length}`);
  }
  return found[0];
}

// A simulator shares the Mac's network, so offline is the stack the app reaches, stopped.
export const APP_SERVICES = ['api', 'mercure', 'storage', 'oidc'];

export function defaultNetwork(dump) {
  const network = /^Active default network: (\S+)/m.exec(dump)?.[1];
  if (!network) throw new Error('dumpsys connectivity names no default network');
  return network === 'none' ? null : network;
}

// A release build refuses http, and a QA stack serves nothing else.
export function allowCleartext(manifest) {
  const decided = /android:usesCleartextTraffic="([^"]*)"/.exec(manifest)?.[1];
  if (decided === 'true') return manifest;
  if (decided !== undefined) {
    throw new Error(`the manifest sets usesCleartextTraffic="${decided}": the QA stack is http`);
  }
  if (!manifest.includes('<application ')) throw new Error('no <application> in the manifest');
  return manifest.replace('<application ', '<application android:usesCleartextTraffic="true" ');
}

// statSync follows a symlinked image directory, which a Dirent would report as a file.
const directoriesIn = (path) =>
  existsSync(path)
    ? readdirSync(path).filter((name) =>
        statSync(join(path, name), { throwIfNoEntry: false })?.isDirectory(),
      )
    : [];

// Only a Play image carries TalkBack, and a host may have any released version of one.
export function playImage(sdk, arch = process.arch) {
  const abi = emulatorAbi(arch);
  const root = join(sdk, 'system-images');
  const installed = directoriesIn(root)
    .map((version) => ({ version, api: Number.parseFloat(version.replace('android-', '')) }))
    .filter(({ api }) => Number.isFinite(api))
    .flatMap(({ version, api }) =>
      directoriesIn(join(root, version))
        .filter((tag) => tag.startsWith('google_apis_playstore'))
        .filter((tag) => existsSync(join(root, version, tag, abi)))
        .map((tag) => ({ version, tag, api })),
    );
  installed.sort((a, b) => b.api - a.api || a.tag.length - b.tag.length);
  const { version, tag } = installed[0] ?? { version: 'android-35', tag: 'google_apis_playstore' };
  return `system-images;${version};${tag};${abi}`;
}

export function expoSdkMajor(expoRange) {
  return /(\d+)\./.exec(expoRange)?.[1];
}

export function expoGoApk(versions, expoRange) {
  const major = expoSdkMajor(expoRange);
  const sdk = (versions.data ?? versions).sdkVersions?.[`${major}.0.0`];
  if (!sdk?.androidClientUrl) throw new Error(`no Expo Go for Android for SDK ${major}`);
  return { url: sdk.androidClientUrl, version: sdk.androidClientVersion };
}

// Android's package is lower case, and every flow, an old commit's included, names iOS's.
// Maestro's openLink names no package, and an emulator can hand exp:// to Expo Go's own home
// rather than the experience, so the harness opens the link instead (sc-3594).
export function forAndroid(flow) {
  return flow
    .replace(/\bhost\.exp\.Exponent\b/g, EXPO_GO_ANDROID)
    .replace(
      /^(\s*)- openLink: \$\{METRO_URL\}(\S*)$/gm,
      (_, indent, path) =>
        `${indent}- evalScript: \${(function () { var response = http.get(HELPER_URL + ` +
        `'/open?path=' + encodeURIComponent(${scriptOf(path)})); if (!response.ok) ` +
        `throw new Error('the harness refused /open: ' + response.body); return response.body; })()}`,
    );
}

// A link's ${VAR}s become the script's own variables, which Maestro already defines.
const scriptOf = (link) =>
  link
    .split(/\$\{([^}]+)\}/)
    .map((part, i) => (i % 2 ? `(${part})` : `'${part.replaceAll("'", "\\'")}'`))
    .filter((part) => part !== "''")
    .join(' + ') || "''";

// The whole directory, so a flow's runFlow and runScript paths still resolve, rewritten too.
export function androidFlows(source, target) {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  for (const entry of readdirSync(target, { recursive: true })) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const path = join(target, entry);
    writeFileSync(path, forAndroid(readFileSync(path, 'utf8')));
  }
}

// Expo Go owns exp:// but not the app's own scheme, so a redirect to it is handed to the
// running experience directly; FLAG_ACTIVITY_SINGLE_TOP delivers it to that one, not a new one.
export function linkIntent(url) {
  if (!/^soirely:\/\//.test(url ?? '')) {
    throw new Error('which link? `link soirely://oauth/…`, copied from the sandbox redirect');
  }
  return [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-f',
    '0x20000000',
    '-n',
    `${EXPO_GO_ANDROID}/host.exp.exponent.experience.ExperienceActivity`,
    '-d',
    `'${url.replaceAll("'", "'\\''")}'`,
  ];
}

export function openIntent(url) {
  return [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `'${url.replaceAll("'", "'\\''")}'`,
    EXPO_GO_ANDROID,
  ];
}

// am start says Error on stdout and still exits 0.
function openOnEmulator(url) {
  const said = adbOut(androidTools(), openIntent(url));
  if (said === null || /^Error/m.test(said)) throw new Error(`could not open ${url}: ${said}`);
}

export function branchForStory(id, remoteBranches) {
  const matches = remoteBranches
    .map((b) => b.trim().replace(/^origin\//, ''))
    .filter((b) => b.split('/').includes(id));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`no remote branch names ${id}`);
  throw new Error(`several remote branches name ${id}: ${matches.join(', ')} — pick one`);
}

// The api container mounts services/api, so its compiled container outlives a checkout
// and can name a service the new commit removed.
export function clearApiCache(root) {
  rmSync(join(root, 'services/api/var/cache'), { recursive: true, force: true });
}

const HERE = dirname(fileURLToPath(import.meta.url));

// QA runs the copy in .qa/bin, gitignored, so checking out an old commit keeps the harness.
const INSTALLED = basename(HERE) === 'bin' && basename(dirname(HERE)) === '.qa';

const AFTER_MIGRATIONS = 'soirely.after-migrations';

const lasting = (service) => service.restart !== 'no';
const afterMigrating = (service) => service.labels?.[AFTER_MIGRATIONS] === 'true';

/** --wait fails when a one-shot init container exits 0, and on a service waiting for migrations. */
export function servicesToWait(services) {
  return Object.entries(services ?? {})
    .filter(([, service]) => lasting(service) && !afterMigrating(service))
    .map(([name]) => name);
}

export function servicesAfterMigrations(services) {
  return Object.entries(services ?? {})
    .filter(([, service]) => lasting(service) && afterMigrating(service))
    .map(([name]) => name);
}

export function composeServices(cwd) {
  const result = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`docker compose config failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout).services;
}

// An older commit's compose.yaml may not name the worker, and compose leaves its container
// running, connected to the database the checkout drops.
export const REBUILD = ['compose', 'up', '-d', '--build', '--remove-orphans'];

export function testerOf(worktree) {
  const match = /^soirely-qa(\d*)$/.exec(basename(worktree));
  return match ? Number(match[1] || 1) : null;
}

let CONFIG = qaConfig(INSTALLED ? (testerOf(resolve(HERE, '../..')) ?? 1) : 1);

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function mainCheckout() {
  const from = INSTALLED ? resolve(HERE, '../..') : resolve(HERE, '..');
  return dirname(resolve(from, git(['rev-parse', '--git-common-dir'], from)));
}

function qaWorktree() {
  if (INSTALLED) return resolve(HERE, '../..');
  return process.env.SOIRELY_QA_WORKTREE ?? join(dirname(mainCheckout()), CONFIG.project);
}

function step(label) {
  process.stdout.write(`\n▸ ${label}\n`);
}

function run(command, args, { cwd, env, optional = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0 && !optional) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
  }
  return result.status === 0;
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return result.status === 0 ? result.stdout.trim() : null;
}

function hashOf(path) {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

function assertQaStack(root) {
  if (resolve(root) === resolve(mainCheckout())) {
    throw new Error(`${root} is the main checkout, not the QA worktree`);
  }
  const env = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
  if (!env.includes(`COMPOSE_PROJECT_NAME=${CONFIG.project}\n`)) {
    throw new Error(`${root}/.env does not name the ${CONFIG.project} compose project`);
  }
}

function setup() {
  const root = qaWorktree();
  const main = mainCheckout();

  step(`The worktree, at ${root}`);
  if (existsSync(join(root, '.git'))) {
    console.log('  already there');
  } else {
    git(['fetch', '--quiet', 'origin'], main);
    // Detached: git refuses a branch that is checked out in the developer's worktree.
    git(['worktree', 'add', '--detach', root, 'origin/main'], main);
  }

  step('The harness, into .qa/bin');
  mkdirSync(join(root, '.qa/bin'), { recursive: true });
  copyFileSync(fileURLToPath(import.meta.url), join(root, '.qa/bin/qa-env.mjs'));

  const settings = join(main, '.claude/settings.local.json');
  if (existsSync(settings) && !existsSync(join(root, '.claude/settings.local.json'))) {
    copyFileSync(settings, join(root, '.claude/settings.local.json'));
  }

  step('The simulators');
  if (capture('xcrun', ['--version']) === null) {
    console.log('  no Xcode here');
  } else {
    for (const sim of Object.values(CONFIG.simulators)) {
      if (simulatorId(sim.name)) {
        console.log(`  ${sim.name}: already there`);
      } else {
        const id = capture('xcrun', ['simctl', 'create', sim.name, sim.type]);
        console.log(id ? `  ${sim.name}: created ${id}` : `  ${sim.name}: could not create one`);
      }
    }
  }

  step('The emulators');
  createEmulators();

  checkout(['main']);
}

function androidTools() {
  const sdk = androidSdk();
  // Every tool on the SDK's adb: a second adb of another version kills this one's server,
  // and the emulator drops offline mid-flow.
  const vars = {
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    ANDROID_AVD_HOME: process.env.ANDROID_AVD_HOME ?? join(homedir(), '.android/avd'),
    PATH: `${join(sdk, 'platform-tools')}:${process.env.PATH}`,
  };
  return {
    sdk,
    adb: join(sdk, 'platform-tools/adb'),
    emulator: join(sdk, 'emulator/emulator'),
    avdmanager: join(sdk, 'cmdline-tools/latest/bin/avdmanager'),
    vars,
    env: { ...process.env, ...vars },
  };
}

function createEmulators() {
  const tools = androidTools();
  if (!existsSync(tools.avdmanager)) {
    console.log(`  no Android SDK command-line tools in ${tools.sdk}`);
    return;
  }
  const image = playImage(tools.sdk);
  const existing = (capture(tools.emulator, ['-list-avds'], { env: tools.env }) ?? '').split('\n');
  for (const avd of Object.values(CONFIG.emulators)) {
    if (existing.includes(avd.name)) {
      console.log(`  ${avd.name}: already there`);
      continue;
    }
    const created = spawnSync(
      tools.avdmanager,
      ['create', 'avd', '-n', avd.name, '-k', image, '-d', avd.device],
      { input: 'no\n', env: tools.env },
    );
    console.log(
      created.status === 0
        ? `  ${avd.name}: created on ${image} in ${tools.vars.ANDROID_AVD_HOME}`
        : `  ${avd.name}: could not create one. Is the image installed? sdkmanager "${image}"`,
    );
  }
}

function checkout(args) {
  const root = qaWorktree();
  const keepData = args.includes('--keep-data');
  const target = parseTarget(args.find((a) => !a.startsWith('--')));

  if (!existsSync(join(root, '.git'))) {
    throw new Error(`no QA worktree at ${root} — run \`node scripts/qa-env.mjs setup\` first`);
  }

  const dirty = git(['status', '--porcelain', '--untracked-files=no'], root);
  if (dirty) throw new Error(`the QA worktree has edits to tracked files:\n${dirty}`);

  step('What to check out');
  git(['fetch', '--quiet', '--prune', 'origin'], root);
  let ref;
  let label;
  if (target.kind === 'pr') {
    const pr = JSON.parse(
      capture('gh', ['pr', 'view', String(target.number), '--json', 'headRefName,headRefOid'], {
        cwd: root,
      }) ?? 'null',
    );
    if (pr === null) throw new Error(`gh could not find pull request #${target.number}`);
    git(['fetch', '--quiet', 'origin', pr.headRefName], root);
    ref = pr.headRefOid;
    label = `#${target.number} (${pr.headRefName})`;
  } else {
    const name =
      target.kind === 'story'
        ? branchForStory(target.id, git(['branch', '-r'], root).split('\n'))
        : target.name;
    ref = `origin/${name}`;
    label = name;
  }
  git(['checkout', '--quiet', '--detach', ref], root);
  const head = git(['rev-parse', '--short', 'HEAD'], root);
  console.log(`  ${label} at ${head}`);
  clearApiCache(root);

  step('The environment');
  writeFileSync(
    join(root, '.env'),
    renderQaEnv(readFileSync(join(root, '.env.example'), 'utf8'), CONFIG.overrides, CONFIG.project),
  );
  assertQaStack(root);
  console.log(`  .env for compose project ${CONFIG.project}`);

  const statePath = join(root, '.qa/state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  const npmLock = hashOf(join(root, 'package-lock.json'));
  const composerLock = hashOf(join(root, 'services/api/composer.lock'));

  const steps = dependencySteps(
    state.npmLock === npmLock && existsSync(join(root, 'node_modules')),
    state.composerLock === composerLock && existsSync(join(root, 'services/api/vendor')),
  );
  for (const entry of steps) {
    if (entry === 'clearApiCache') {
      clearApiCache(root);
      continue;
    }
    step(entry.step);
    if (entry.run) run(...entry.run, { cwd: root });
    else console.log('  lockfile unchanged');
  }
  writeFileSync(statePath, JSON.stringify({ npmLock, composerLock, head, label }, null, 2));

  step('The stack, rebuilt from this commit');
  run('docker', REBUILD, { cwd: root });
  run(
    'docker',
    ['compose', 'up', '-d', '--wait', '--no-recreate', ...servicesToWait(composeServices(root))],
    { cwd: root },
  );

  const console_ = ['compose', 'exec', '-T', 'api', 'php', 'bin/console'];
  run('docker', [...console_, 'lexik:jwt:generate-keypair', '--skip-if-exists'], { cwd: root });

  step(keepData ? 'The database, migrated' : 'The database, from nothing');
  const afterMigrations = servicesAfterMigrations(composeServices(root));
  for (const args of databaseCommands(console_, afterMigrations, keepData)) {
    run('docker', args, { cwd: root });
  }

  status();
  console.log(
    '\nA bundler already running is serving the previous checkout. Restart `ios` or `android`.',
  );
}

// The api cache is cleared again once the new vendor is in: a worker restarting during the
// install compiles a container against the old vendor, dropping what it cannot load.
export function dependencySteps(npmUnchanged, composerUnchanged) {
  return [
    {
      step: 'Node dependencies',
      run: npmUnchanged ? null : ['npm', ['ci', '--no-audit', '--no-fund']],
    },
    {
      step: 'PHP dependencies',
      run: composerUnchanged ? null : ['node', ['scripts/php-tool.mjs', 'composer', 'install']],
    },
    'clearApiCache',
  ];
}

// With no names, compose stop and up act on the whole stack, so an old commit with no
// worker skips both.
export function databaseCommands(console_, afterMigrations, keepData) {
  const waiting = afterMigrations.length > 0;
  return [
    // From nothing: an edited unreleased migration leaves a migrated database wrong.
    ...(keepData
      ? []
      : [
          // Postgres refuses to drop a database the worker is still connected to.
          ...(waiting ? [['compose', 'stop', ...afterMigrations]] : []),
          [...console_, 'doctrine:database:drop', '--if-exists', '--force'],
          [...console_, 'doctrine:database:create'],
        ]),
    [...console_, 'doctrine:migrations:migrate', '-n', '--allow-no-migration'],
    // Recreated, so a health check failed while waiting for the schema does not end --wait at once.
    ...(waiting ? [['compose', 'up', '-d', '--wait', '--force-recreate', ...afterMigrations]] : []),
  ];
}

function status() {
  const root = qaWorktree();
  const state = existsSync(join(root, '.qa/state.json'))
    ? JSON.parse(readFileSync(join(root, '.qa/state.json'), 'utf8'))
    : {};
  const head = capture('git', ['log', '-1', '--format=%h %s'], { cwd: root });
  const health = capture('curl', [
    '-sf',
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    `${CONFIG.urls.api}/api/health`,
  ]);

  console.log(`
QA environment, tester ${CONFIG.tester} — ${root}
  Checked out  ${state.label ?? '?'} — ${head ?? 'no worktree'}
  API          ${CONFIG.urls.api}   ${health === '200' ? 'answering' : 'NOT answering'}
  Web          ${CONFIG.urls.web}
  App          ${CONFIG.urls.metro}   (node .qa/bin/qa-env.mjs ios, or android)
  Mailpit      ${CONFIG.urls.mailpit}
  Smocker      ${CONFIG.urls.smocker}
  Postgres     docker compose exec postgres psql -U soirely -d soirely   (from the worktree)`);
}

function simulatorId(name) {
  const list = JSON.parse(
    capture('xcrun', ['simctl', 'list', 'devices', 'available', '-j']) ?? '{}',
  );
  for (const devices of Object.values(list.devices ?? {})) {
    const found = devices.find((d) => d.name === name);
    if (found) return found.udid;
  }
  return null;
}

// iOS offers to save a password after every sign-in, and on an iPad Maestro cannot see the
// sheet to dismiss it. The restriction a device profile would set turns the offer off; the
// simulator reads it when it boots.
export function passwordAutoFillFiles(device) {
  const profiles = join(device, 'data/Library/UserConfigurationProfiles');
  return [
    join(profiles, 'UserSettings.plist'),
    join(profiles, 'EffectiveUserSettings.plist'),
    join(profiles, 'PublicInfo/PublicEffectiveUserSettings.plist'),
  ];
}

export function passwordAutoFillOff(file) {
  return [
    ['-insert', 'restrictedBool', '-dictionary', file],
    ['-insert', 'restrictedBool.allowPasswordAutoFill', '-dictionary', file],
    ['-replace', 'restrictedBool.allowPasswordAutoFill.value', '-bool', 'NO', file],
  ];
}

const deviceFiles = (udid) =>
  passwordAutoFillFiles(join(homedir(), 'Library/Developer/CoreSimulator/Devices', udid));

const passwordAutoFillIsOff = (udid) =>
  deviceFiles(udid).every(
    (file) =>
      capture('plutil', ['-extract', 'restrictedBool.allowPasswordAutoFill.value', 'raw', file]) ===
      'false',
  );

function withoutPasswordAutoFill(udid) {
  if (passwordAutoFillIsOff(udid)) return;
  const files = deviceFiles(udid);
  run('xcrun', ['simctl', 'shutdown', udid], { optional: true });
  for (const file of files) {
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) run('plutil', ['-create', 'xml1', file]);
    for (const step of passwordAutoFillOff(file)) run('plutil', step, { optional: true });
  }
}

function ensureExpoGo(udid) {
  if (capture('xcrun', ['simctl', 'get_app_container', udid, EXPO_GO])) return true;
  const list = JSON.parse(capture('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']) ?? '{}');
  for (const device of Object.values(list.devices ?? {}).flat()) {
    const app = capture('xcrun', ['simctl', 'get_app_container', device.udid, EXPO_GO, 'app']);
    if (app) return run('xcrun', ['simctl', 'install', udid, app], { optional: true });
  }
  return false;
}

function installedIosRelease(root) {
  return join(root, '.qa/release/ios-release-on');
}

// A release build on the simulator not opened still owns soirely:// there. simctl
// uninstalls only on a booted device, so that one is booted for it, then shut.
function shutSimulator(root, key, id) {
  const udid = simulatorId(CONFIG.simulators[key].name);
  if (!udid) return;
  if (iosReleaseOn(root, key)) {
    run('xcrun', ['simctl', 'boot', udid], { optional: true });
    if (run('xcrun', ['simctl', 'uninstall', udid, id], { optional: true })) {
      clearIosRelease(root, key);
    }
  }
  run('xcrun', ['simctl', 'shutdown', udid], { optional: true });
}

function iosReleaseOn(root, key) {
  const recorded = installedIosRelease(root);
  return existsSync(recorded) && readFileSync(recorded, 'utf8').trim() === key;
}

function clearIosRelease(root, key) {
  if (iosReleaseOn(root, key)) rmSync(installedIosRelease(root));
}

async function ios(args) {
  const root = qaWorktree();
  assertQaStack(root);
  const { open, shut } = simulatorFor(args);
  const id = iosBundle(readFileSync(join(root, 'apps/mobile/app.config.ts'), 'utf8'));
  shutSimulator(root, shut, id);
  // An offline release launch stopped these; a release build owns soirely:// while installed.
  startAppServices(root);
  const devices = [open].map((key) => {
    const udid = simulatorId(CONFIG.simulators[key].name);
    if (!udid) throw new Error(`no ${CONFIG.simulators[key].name} simulator — run setup`);
    withoutPasswordAutoFill(udid);
    run('xcrun', ['simctl', 'boot', udid], { optional: true });
    if (run('xcrun', ['simctl', 'uninstall', udid, id], { optional: true })) {
      clearIosRelease(root, open);
    }
    if (!ensureExpoGo(udid)) {
      throw new Error(
        `Expo Go is on no booted simulator to copy from. Install it once with \`npx expo start --ios\` on any simulator, then rerun.`,
      );
    }
    return udid;
  });
  run('open', ['-a', 'Simulator'], { optional: true });

  const metro = await startBundler(root);
  for (const udid of devices)
    run('xcrun', ['simctl', 'openurl', udid, CONFIG.urls.metro], { optional: true });
  console.log(`\nBundler on ${CONFIG.urls.metro}, open on the ${open}. Leave it running.`);

  await new Promise((done) => metro.on('exit', done));
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

function usesSystemd() {
  return process.platform === 'linux' && capture('systemd-run', ['--version']) !== null;
}

// A process over its cap is stopped alone, before systemd-oomd stops the whole desktop session.
function capped(memory, command, args) {
  if (!usesSystemd()) return [command, args];
  return [
    'systemd-run',
    ['--user', '--scope', '--quiet', '-p', `MemoryMax=${memory}`, command, ...args],
  ];
}

async function startBundler(root, env = process.env) {
  const [command, args] = capped('4G', 'npx', [
    'expo',
    'start',
    '--port',
    String(CONFIG.ports.METRO_PORT),
  ]);
  const metro = spawn(command, args, {
    cwd: join(root, 'apps/mobile'),
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...env, ...CONFIG.app, EXPO_PUBLIC_ENVIRONMENT: 'qa' },
  });
  // The whole group: npx dies on a signal and leaves the bundler it started holding the port.
  const stop = (signal) => {
    try {
      process.kill(-metro.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
  process.on('exit', () => stop('SIGTERM'));

  const statusUrl = `http://127.0.0.1:${CONFIG.ports.METRO_PORT}/status`;
  for (let i = 0; i < 120; i++) {
    const answer = await fetch(statusUrl).then(
      (r) => r.text(),
      () => '',
    );
    if (answer.includes('running')) break;
    await pause(1000);
  }
  return metro;
}

const LAUNCH_RECORDING = '/sdcard/soirely-launch.mp4';

function emulatorSerial() {
  return `emulator-${CONFIG.emulatorPort}`;
}

function adbOut(tools, args) {
  return capture(tools.adb, ['-s', emulatorSerial(), ...args], { env: tools.env });
}

function emulatorOnline(tools) {
  return (capture(tools.adb, ['devices'], { env: tools.env }) ?? '').includes(
    `${emulatorSerial()}\tdevice`,
  );
}

function unitState(unit) {
  return spawnSync('systemctl', ['--user', 'is-active', unit], { encoding: 'utf8' }).stdout.trim();
}

async function stopEmulator(tools) {
  const unit = `${CONFIG.project}-emulator`;
  adbOut(tools, ['emu', 'kill']);
  for (let i = 0; i < 60; i++) {
    const stopping =
      usesSystemd() && ['active', 'activating', 'deactivating'].includes(unitState(unit));
    if (!emulatorOnline(tools) && !stopping) return;
    await pause(1000);
  }
  throw new Error(`the emulator on ${emulatorSerial()} did not stop within a minute`);
}

async function bootEmulator(tools, name) {
  const running = adbOut(tools, ['emu', 'avd', 'name'])?.split('\n')[0].trim();
  if (running === name) {
    console.log(`  ${name}: already running on ${emulatorSerial()}`);
    return;
  }
  if (running) await stopEmulator(tools);

  const args = [
    '-avd',
    name,
    '-port',
    String(CONFIG.emulatorPort),
    '-no-window',
    '-no-audio',
    '-no-boot-anim',
    '-gpu',
    emulatorGpu(),
    '-no-snapshot-save',
  ];
  if (usesSystemd()) {
    const env = Object.entries(tools.vars).map(([key, value]) => `--setenv=${key}=${value}`);
    run('systemd-run', [
      '--user',
      `--unit=${CONFIG.project}-emulator`,
      '--collect',
      '--quiet',
      '-p',
      'MemoryMax=6G',
      ...env,
      tools.emulator,
      ...args,
    ]);
  } else {
    const log = openSync(join(qaWorktree(), '.qa/emulator.log'), 'a');
    spawn(tools.emulator, args, {
      detached: true,
      stdio: ['ignore', log, log],
      env: tools.env,
    }).unref();
  }

  for (let i = 0; i < 180; i++) {
    if (adbOut(tools, ['shell', 'getprop', 'sys.boot_completed']) === '1') {
      console.log(`  ${name}: booted on ${emulatorSerial()}`);
      return;
    }
    await pause(1000);
  }
  throw new Error(`${name} did not boot within three minutes`);
}

async function ensureAndroidExpoGo(tools, root) {
  const expo = JSON.parse(readFileSync(join(root, 'apps/mobile/package.json'), 'utf8')).dependencies
    .expo;
  const dumped = adbOut(tools, ['shell', 'dumpsys', 'package', EXPO_GO_ANDROID]) ?? '';
  const installed = /versionName=(\S+)/.exec(dumped)?.[1];
  if (installed && installed.split('.')[0] === expoSdkMajor(expo)) return false;

  const versions = await fetch('https://api.expo.dev/v2/versions').then((r) => r.json());
  const apk = expoGoApk(versions, expo);
  const cache = join(homedir(), '.cache/soirely/expo-go');
  const file = join(cache, basename(new URL(apk.url).pathname));
  if (!existsSync(file)) {
    console.log(`  downloading Expo Go ${apk.version}`);
    mkdirSync(cache, { recursive: true });
    const response = await fetch(apk.url);
    if (!response.ok) throw new Error(`Expo Go download: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${file}.part`));
    renameSync(`${file}.part`, file);
  }
  run(tools.adb, ['-s', emulatorSerial(), 'install', '-r', file], { env: tools.env });
  return true;
}

function maestroBin() {
  if (capture('sh', ['-c', 'command -v maestro']) !== null) return 'maestro';
  const local = join(homedir(), '.maestro/bin/maestro');
  return existsSync(local) ? local : null;
}

// Expo Go lays its developer menu over the app once per install, and hides the app from a flow.
function dismissExpoGoIntro(tools, root) {
  const flow = join(root, '.qa/expo-go-intro.yaml');
  writeFileSync(
    flow,
    [
      `appId: ${EXPO_GO_ANDROID}`,
      '---',
      '- extendedWaitUntil:',
      "    visible: 'Continue'",
      '    timeout: 180000',
      '    optional: true',
      '- tapOn:',
      "    text: 'Continue'",
      '    optional: true',
      '',
    ].join('\n'),
  );
  const binary = maestroBin();
  const ok =
    binary !== null &&
    run(binary, ['--device', emulatorSerial(), 'test', flow], { env: tools.env, optional: true });
  if (!ok) console.log('  Expo Go shows its developer menu once: tap Continue before a flow runs.');
}

async function android(args) {
  const tools = androidTools();
  if (!existsSync(tools.emulator)) {
    throw new Error(`no Android emulator in ${tools.sdk}: set ANDROID_HOME`);
  }
  if (args.includes('--stop')) {
    await stopEmulator(tools);
    console.log(`Stopped the emulator on ${emulatorSerial()}.`);
    return;
  }
  const root = qaWorktree();
  assertQaStack(root);
  const { open } = emulatorFor(args);
  startAppServices(root);

  step(`The ${open}`);
  await bootEmulator(tools, CONFIG.emulators[open].name);
  removeRelease(tools, root);
  airplaneMode(tools, false);
  const fresh = await ensureAndroidExpoGo(tools, root);
  for (const port of reversedPorts(CONFIG.ports)) {
    adbOut(tools, ['reverse', `tcp:${port}`, `tcp:${port}`]);
  }

  step('The bundler');
  const metro = await startBundler(root, tools.env);
  adbOut(tools, [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    CONFIG.urls.metro,
    EXPO_GO_ANDROID,
  ]);
  if (fresh) dismissExpoGoIntro(tools, root);
  console.log(
    `\nBundler on ${CONFIG.urls.metro}, open on the ${open} (${emulatorSerial()}). Leave it running.`,
  );

  await new Promise((done) => metro.on('exit', done));
}

function link(args) {
  const intent = linkIntent(args.find((a) => !a.startsWith('--')));
  const tools = androidTools();
  if (!emulatorOnline(tools)) {
    throw new Error(`no emulator on ${emulatorSerial()} — run \`android\` first`);
  }
  run(tools.adb, ['-s', emulatorSerial(), ...intent], { env: tools.env });
}

// The bundle and fonts inside, so the app runs without Metro, offline from first launch.
function buildRelease(tools, root, apk) {
  const mobile = join(root, 'apps/mobile');
  const env = { ...tools.env, ...CONFIG.app, EXPO_PUBLIC_ENVIRONMENT: 'qa', CI: '1' };

  // prebuild rewrites the start scripts in package.json to expo run:*, a change nobody asked for.
  const pkg = join(mobile, 'package.json');
  const scripts = readFileSync(pkg, 'utf8');
  try {
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install', '--clean'], {
      cwd: mobile,
      env,
    });
  } finally {
    writeFileSync(pkg, scripts);
  }
  const manifest = join(mobile, 'android/app/src/main/AndroidManifest.xml');
  writeFileSync(manifest, allowCleartext(readFileSync(manifest, 'utf8')));

  const [command, args] = capped('10G', './gradlew', [
    'assembleRelease',
    '--no-daemon',
    '--max-workers=4',
    `-PreactNativeArchitectures=${emulatorAbi()}`,
    '-Dorg.gradle.jvmargs=-Xmx4g',
  ]);
  run(command, args, { cwd: join(mobile, 'android'), env: { ...env, NODE_ENV: 'production' } });

  mkdirSync(dirname(apk), { recursive: true });
  copyFileSync(join(mobile, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
  rmSync(join(mobile, 'android'), { recursive: true, force: true });
  for (const name of staleBuilds(readdirSync(dirname(apk)), apk)) rmSync(join(dirname(apk), name));
}

function airplaneMode(tools, on) {
  adbOut(tools, ['shell', 'cmd', 'connectivity', 'airplane-mode', on ? 'enable' : 'disable']);
}

// Airplane mode returns once the setting is written; Wi-Fi and the modem drop afterwards.
async function waitOffline(tools) {
  for (let i = 0; i < 20; i++) {
    const dump = adbOut(tools, ['shell', 'dumpsys', 'connectivity']);
    if (dump && defaultNetwork(dump) === null) return;
    await pause(500);
  }
  throw new Error('the emulator still has a network ten seconds after airplane mode went on');
}

function installedRelease(root) {
  return join(root, '.qa/release/installed');
}

// It owns soirely://; the package is read from the record, as this harness copy predates the config.
// The record stays: the build is on one AVD, and an uninstall on another finds nothing.
function removeRelease(tools, root) {
  const recorded = installedRelease(root);
  if (!existsSync(recorded)) return;
  adbOut(tools, ['uninstall', readFileSync(recorded, 'utf8').trim()]);
}

function recordLaunch(tools) {
  const recorder = spawn(
    tools.adb,
    ['-s', emulatorSerial(), 'shell', 'screenrecord', '--time-limit', '15', LAUNCH_RECORDING],
    { stdio: 'ignore', env: tools.env },
  );
  return new Promise((done) => {
    recorder.on('error', () => done());
    recorder.on('exit', () => done());
  });
}

function releaseCommit(root) {
  assertQaStack(root);
  if (git(['status', '--porcelain', '--untracked-files=no'], root) !== '') {
    throw new Error(`${root} has uncommitted changes: a release build names one commit`);
  }
  const sha = git(['rev-parse', 'HEAD'], root);
  const subject = git(['log', '-1', '--format=%s', sha], root);
  const onMain =
    spawnSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], {
      cwd: root,
    }).status === 0;
  step(`A release build of ${sha.slice(0, 12)} (${subject})`);
  if (!onMain) console.log('  not on origin/main: this is a branch build');
  return sha;
}

function release(args) {
  return releasePlatform(args) === 'ios' ? releaseIos(args) : releaseAndroid(args);
}

async function releaseAndroid(args) {
  const tools = androidTools();
  if (!existsSync(tools.emulator)) {
    throw new Error(`no Android emulator in ${tools.sdk}: set ANDROID_HOME`);
  }
  const root = qaWorktree();
  const sha = releaseCommit(root);
  const { open } = emulatorFor(args);
  const offline = args.includes('--offline');

  const apk = releaseApk(root, sha);
  startAppServices(root);
  if (existsSync(apk) && !args.includes('--rebuild')) {
    console.log(`  already built: ${apk}`);
  } else {
    buildRelease(tools, root, apk);
  }

  step(`The ${open}`);
  await bootEmulator(tools, CONFIG.emulators[open].name);
  // A fresh install every time, so the launch below is the app's first, with no cache.
  const id = androidPackage(readFileSync(join(root, 'apps/mobile/app.config.ts'), 'utf8'));
  removeRelease(tools, root);
  adbOut(tools, ['uninstall', id]);
  run(tools.adb, ['-s', emulatorSerial(), 'install', apk], { env: tools.env });
  writeFileSync(installedRelease(root), id);
  airplaneMode(tools, offline);
  if (offline) {
    adbOut(tools, ['reverse', '--remove-all']);
    await waitOffline(tools);
  } else {
    for (const port of reversedPorts(CONFIG.ports)) {
      adbOut(tools, ['reverse', `tcp:${port}`, `tcp:${port}`]);
    }
  }

  const recording = recordLaunch(tools);
  await pause(1000);
  adbOut(tools, ['shell', 'am', 'start', '-n', `${id}/.MainActivity`]);
  await recording;
  const video = launchVideo(root, sha, 'android', open);
  rmSync(video, { force: true });
  adbOut(tools, ['pull', LAUNCH_RECORDING, video]);
  adbOut(tools, ['shell', 'rm', '-f', LAUNCH_RECORDING]);
  console.log(
    `\nSoirely ${sha.slice(0, 12)}, a release build, on its first launch on the ${open}` +
      ` (${emulatorSerial()}), ${offline ? 'offline: no default network, no stack' : 'online'}.` +
      `\n${existsSync(video) ? `Its first 15 seconds: ${video}` : 'The launch was not recorded.'}` +
      `\nThe next \`android\` removes it and turns airplane mode off.`,
  );
}

// The same bundle as on Android, and Release, so the JS and fonts are inside and Metro is not asked.
function buildIosRelease(root, app) {
  if (capture('pod', ['--version']) === null) {
    throw new Error('no CocoaPods on this Mac: brew install cocoapods');
  }
  const mobile = join(root, 'apps/mobile');
  const env = { ...CONFIG.app, EXPO_PUBLIC_ENVIRONMENT: 'qa', CI: '1' };

  const pkg = join(mobile, 'package.json');
  const scripts = readFileSync(pkg, 'utf8');
  try {
    run('npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install', '--clean'], {
      cwd: mobile,
      env,
    });
  } finally {
    writeFileSync(pkg, scripts);
  }
  const ios = join(mobile, 'ios');
  run('pod', ['install'], { cwd: ios, env });
  const workspace = xcodeWorkspace(readdirSync(ios));
  const scheme = basename(workspace, '.xcworkspace');
  // A release build refuses http, and a QA stack serves nothing else.
  run('plutil', [
    '-replace',
    'NSAppTransportSecurity',
    '-json',
    '{"NSAllowsArbitraryLoads":true}',
    join(ios, scheme, 'Info.plist'),
  ]);

  const derived = join(ios, 'build');
  run(
    'xcodebuild',
    [
      '-workspace',
      workspace,
      '-scheme',
      scheme,
      '-configuration',
      'Release',
      '-sdk',
      'iphonesimulator',
      '-destination',
      'generic/platform=iOS Simulator',
      '-derivedDataPath',
      derived,
      `ARCHS=${simulatorArch()}`,
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    { cwd: ios, env: { ...env, NODE_ENV: 'production' } },
  );

  mkdirSync(dirname(app), { recursive: true });
  rmSync(app, { recursive: true, force: true });
  cpSync(join(derived, 'Build/Products/Release-iphonesimulator', `${scheme}.app`), app, {
    recursive: true,
  });
  rmSync(ios, { recursive: true, force: true });
  for (const name of staleBuilds(readdirSync(dirname(app)), app)) {
    rmSync(join(dirname(app), name), { recursive: true, force: true });
  }
}

function stopAppServices(root) {
  run('docker', ['compose', 'stop', ...APP_SERVICES], { cwd: root });
}

// Makes what a `down` removed, where `start` fails on a stack with no containers.
function startAppServices(root) {
  run('docker', ['compose', 'up', '-d', '--wait', '--no-recreate', ...APP_SERVICES], {
    cwd: root,
  });
}

function recordSimulator(udid, video) {
  rmSync(video, { force: true });
  const recorder = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--force', video], {
    stdio: 'ignore',
  });
  const stopped = new Promise((done) => {
    recorder.on('error', () => done());
    recorder.on('exit', () => done());
  });
  return async () => {
    await pause(15000);
    recorder.kill('SIGINT');
    await stopped;
  };
}

async function releaseIos(args) {
  const root = qaWorktree();
  const sha = releaseCommit(root);
  const { open, shut } = simulatorFor(args);
  const offline = args.includes('--offline');

  const app = releaseApp(root, sha);
  if (existsSync(app) && !args.includes('--rebuild')) {
    console.log(`  already built: ${app}`);
  } else {
    buildIosRelease(root, app);
  }

  step(`The ${open}`);
  const id = iosBundle(readFileSync(join(root, 'apps/mobile/app.config.ts'), 'utf8'));
  shutSimulator(root, shut, id);
  const udid = simulatorId(CONFIG.simulators[open].name);
  if (!udid) throw new Error(`no ${CONFIG.simulators[open].name} simulator — run setup`);
  withoutPasswordAutoFill(udid);
  run('xcrun', ['simctl', 'boot', udid], { optional: true });
  run('open', ['-a', 'Simulator'], { optional: true });
  // A fresh install every time, so the launch below is the app's first, with no cache.
  run('xcrun', ['simctl', 'uninstall', udid, id], { optional: true });
  run('xcrun', ['simctl', 'install', udid, app]);
  writeFileSync(installedIosRelease(root), open);
  if (offline) stopAppServices(root);
  else startAppServices(root);

  const video = launchVideo(root, sha, 'ios', open);
  const recorded = recordSimulator(udid, video);
  await pause(1000);
  run('xcrun', ['simctl', 'launch', udid, id]);
  await recorded();
  console.log(
    `\nSoirely ${sha.slice(0, 12)}, a release build, on its first launch on the ${open}` +
      `, ${offline ? `offline: ${APP_SERVICES.join(', ')} stopped` : 'online'}.` +
      `\n${existsSync(video) ? `Its first 15 seconds: ${video}` : 'The launch was not recorded.'}` +
      `\nThe next \`ios\` removes it and starts the stack again.` +
      (offline
        ? `\nWeb and android see the stack stopped too, until \`ios\`, \`android\` or \`release\` without --offline starts it.`
        : ''),
  );
}

function maestroDevice(args) {
  if (args.includes('--android')) {
    if (!emulatorOnline(androidTools())) {
      throw new Error(`no emulator on ${emulatorSerial()} — run \`android\` first`);
    }
    return emulatorSerial();
  }
  const device = args.includes('--ipad') ? CONFIG.simulators.ipad : CONFIG.simulators.phone;
  const udid = simulatorId(device.name);
  if (!udid) throw new Error(`no ${device.name} simulator — run setup`);
  return udid;
}

export function maestroTarget(device, onAndroid, driverPort) {
  const target = ['--device', device];
  return onAndroid ? target : [...target, '--driver-host-port', String(driverPort)];
}

function hierarchy(args) {
  const onAndroid = args.includes('--android');
  const ok = run(
    maestroBin() ?? 'maestro',
    [...maestroTarget(maestroDevice(args), onAndroid, CONFIG.driverPort), 'hierarchy'],
    {
      cwd: qaWorktree(),
      optional: true,
      env: onAndroid ? androidTools().env : {},
    },
  );
  if (!ok) process.exitCode = 1;
}

async function maestro(args) {
  const root = qaWorktree();
  const onAndroid = args.includes('--android');
  const [flow, ...vars] = args.filter((a) => !a.startsWith('--'));
  if (!flow) throw new Error('which flow? `maestro sign-in EMAIL=… PASSWORD=…`');
  const device = maestroDevice(args);

  const env = [`METRO_URL=${CONFIG.urls.metro}`, `MAILPIT_URL=${CONFIG.urls.mailpit}`, ...vars];
  // An Android flow's links are opened by the harness: forAndroid.
  const helper = onAndroid ? await startHelper({ heard: { at: 0 }, device, onAndroid }) : null;
  if (helper) env.push(`HELPER_URL=http://127.0.0.1:${CONFIG.helperPort}`);
  const out = join(root, '.qa', flow);
  spawnSync('rm', ['-rf', out]);
  mkdirSync(out, { recursive: true });

  let flows = join(root, 'apps/mobile/.maestro');
  if (onAndroid) {
    const copy = join(root, '.qa/.maestro-android');
    androidFlows(flows, copy);
    flows = copy;
  }
  const file = join(flows, `${flow}.yaml`);

  const ok = await runAsync(
    maestroBin() ?? 'maestro',
    [
      ...maestroTarget(device, onAndroid, CONFIG.driverPort),
      'test',
      '--debug-output',
      out,
      ...env.flatMap((e) => ['-e', e]),
      file,
    ],
    { cwd: root, env: onAndroid ? androidTools().env : {}, timeoutMs: runBudgetMs(1) },
  );
  helper?.close();
  spawnSync('sh', ['-c', `find "${out}" -mindepth 2 -name '*.png' -exec cp {} "${out}/" \\;`]);
  console.log(`\nEvidence in ${out}`);
  if (!ok) process.exitCode = 1;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const STEP_MS = 30_000;

// RFC 6238 as the API reads it: SHA-1, six digits, 30-second steps.
export function totp(secret, step) {
  const bits = [...secret.toUpperCase().replace(/[\s=]/g, '')]
    .map((char) => {
      const at = BASE32.indexOf(char);
      if (at === -1) throw new Error('a two-factor secret is base32');
      return at.toString(2).padStart(5, '0');
    })
    .join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', key).update(counter).digest();
  const offset = mac[mac.length - 1] & 0xf;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

// The API refuses a code at or before the last step it accepted, so each code is a step past it.
export function codeStep(now, last) {
  const current = Math.floor(now / STEP_MS);
  const step = last == null ? current : Math.max(current, last + 1);
  return { step, waitMs: Math.max(0, step * STEP_MS - now) };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `{{t:key}}` is the batch language's string and `{{t:any:key}}` any language's, as a Maestro
// regex inside single quotes. `|email` fills the account's address in; any other value is `.*`.
export function localise(flow, catalogues, language, values = {}) {
  return flow.replace(/\{\{t:(any:)?([\w.]+)((?:\|\w+)*)\}\}/g, (_, any, key, given) => {
    const filled = given.split('|').filter(Boolean);
    const languages = any || language === 'any' ? Object.keys(catalogues) : [language];
    const patterns = languages.map((code) => {
      const text = key.split('.').reduce((node, part) => node?.[part], catalogues[code]);
      if (typeof text !== 'string') throw new Error(`no ${key} in the ${code} catalogue`);
      return text
        .split(/(\{\{\w+\}\})/)
        .map((part) => {
          const name = /^\{\{(\w+)\}\}$/.exec(part)?.[1];
          if (name === undefined) return escapeRegex(part);
          return filled.includes(name) ? escapeRegex(values[name] ?? '') : '.*';
        })
        .join('');
    });
    const unique = [...new Set(patterns)];
    const pattern = unique.length === 1 ? unique[0] : `(?:${unique.join('|')})`;
    return pattern.replaceAll("'", "''");
  });
}

export const checkId = (check, language) => (language === 'any' ? check : `${check}.${language}`);

const helperStep = (ask, file) =>
  ['- runScript:', `    file: ${file}`, '    env:', `      ASK: '${ask}'`, ''].join('\n');

export function batchCheck(flow, check, language, { reset }) {
  const at = flow.indexOf('\n---\n');
  if (at === -1) throw new Error(`${check}: no --- between its config and its commands`);
  const id = checkId(check, language);
  const commands = flow
    .slice(at + 5)
    .replace(/^(\s*-\s*takeScreenshot:\s*)(['"]?)([^'"\s]+)\2\s*$/gm, `$1${id}-$3`)
    .trimEnd();
  return [
    flow.slice(0, at + 5),
    helperStep(`/started?check=${encodeURIComponent(id)}`, '../batch/helper.js'),
    reset ? '- runFlow: ../batch/reset.yaml\n' : '',
    `${commands}\n`,
    helperStep(`/passed?check=${encodeURIComponent(id)}`, '../batch/helper.js'),
  ].join('');
}

export const batchRuns = (checks, languages) =>
  languages.flatMap((language) => checks.map((check) => ({ check, language })));

export function batchFlow({ checks, languages, cold, runs = batchRuns(checks, languages) }) {
  const lines = [`appId: ${EXPO_GO}`, '---', '- launchApp:', `    appId: ${EXPO_GO}`];
  lines.push(`    stopApp: ${cold ? 'true' : 'false'}`);
  if (cold) lines.push('- runFlow: batch/sign-out.yaml');
  else lines.push(helperStep('/reload', 'batch/helper.js').trimEnd());
  lines.push('- runFlow: batch/session.yaml');
  runs.forEach(({ check, language }, index) => {
    if (index > 0 && language !== runs[index - 1].language)
      lines.push(helperStep(`/language?to=${language}`, 'batch/helper.js').trimEnd());
    lines.push(
      '- runFlow:',
      `    file: _checks/${checkId(check, language)}.yaml`,
      '    optional: true',
    );
  });
  return `${lines.join('\n')}\n`;
}

export function composeBatch(
  source,
  target,
  { checks, languages, cold, catalogues, email, onAndroid },
) {
  const finish = (flow) => (onAndroid ? forAndroid(flow) : flow);
  if (onAndroid) androidFlows(source, target);
  else {
    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
  }
  for (const entry of readdirSync(target, { recursive: true })) {
    if (!/\.ya?ml$/.test(entry) || entry.startsWith('checks')) continue;
    const path = join(target, entry);
    writeFileSync(path, localise(readFileSync(path, 'utf8'), catalogues, 'any', { email }));
  }
  mkdirSync(join(target, '_checks'));
  for (const language of languages) {
    for (const check of checks) {
      const flow = localise(
        readFileSync(join(source, 'checks', `${check}.yaml`), 'utf8'),
        catalogues,
        language,
        { email },
      );
      const id = checkId(check, language);
      writeFileSync(
        join(target, '_checks', `${id}.yaml`),
        finish(batchCheck(flow, check, language, { reset: !cold })),
      );
      if (cold) {
        writeFileSync(
          join(target, `_cold.${id}.yaml`),
          finish(batchFlow({ checks: [check], languages: [language], cold })),
        );
      }
    }
  }
  if (!cold) writeFileSync(join(target, '_batch.yaml'), finish(batchFlow({ checks, languages })));
}

export function parseBatch(args) {
  const positional = [];
  const vars = {};
  let languages = ['any'];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--lang') languages = (args[++i] ?? '').split(',').filter(Boolean);
    else if (arg.startsWith('--')) continue;
    else if (/^[A-Z][A-Z0-9_]*=/.test(arg))
      vars[arg.slice(0, arg.indexOf('='))] = arg.slice(arg.indexOf('=') + 1);
    else positional.push(arg);
  }
  const [name, ...checks] = positional;
  if (!name || checks.length === 0 || languages.length === 0) {
    throw new Error(
      'which batch? `batch <name> <check>… EMAIL=… PASSWORD=… [--lang en,es] [--cold]`',
    );
  }
  return { name, checks, languages, vars, cold: args.includes('--cold') };
}

async function api(path, { method = 'POST', body, token } = {}) {
  const response = await fetch(`${CONFIG.urls.api}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Soirely-QA/1.0 (scripts/qa-env.mjs)',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const answer = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `${path} answered ${response.status}: ${answer?.detail ?? answer?.title ?? response.statusText}`,
    );
  }
  return answer;
}

// Kept across runs: five batches in a row are five processes, and each must use a later step.
function usedSteps() {
  const file = join(qaWorktree(), '.qa/two-factor-steps.json');
  return { file, used: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {} };
}

async function nextCode(email, secret) {
  const { waitMs } = codeStep(Date.now(), usedSteps().used[email]);
  await pause(waitMs);
  const { file, used } = usedSteps();
  const { step } = codeStep(Date.now(), used[email]);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...used, [email]: step }, null, 2));
  return totp(secret, step);
}

async function apiSession(email, password, secret) {
  const answer = await api('/api/auth/login', { body: { email, password } });
  if (typeof answer.twoFactorChallenge !== 'string') return answer.accessToken;
  if (!secret) throw new Error(`${email} has two-factor on: pass TOTP_SECRET=…`);
  const code = await nextCode(email, secret);
  return (
    await api('/api/auth/two-factor/verify', {
      body: { challenge: answer.twoFactorChallenge, code },
    })
  ).accessToken;
}

async function reloadApp() {
  const Socket = globalThis.WebSocket ?? (await import('ws')).WebSocket;
  return new Promise((done, failed) => {
    const socket = new Socket(`ws://127.0.0.1:${CONFIG.ports.METRO_PORT}/message`);
    socket.onopen = () => {
      socket.send(JSON.stringify({ version: 2, method: 'reload' }));
      socket.close();
      done();
    };
    socket.onerror = () => failed(new Error(`no bundler on ${CONFIG.ports.METRO_PORT} to reload`));
  });
}

export function expoGoRunning(launchctlList) {
  return new RegExp(
    `^\\d+\\s+\\S+\\s+UIKitApplication:${EXPO_GO.replaceAll('.', '\\.')}\\[`,
    'm',
  ).test(launchctlList);
}

function appRunning(device, onAndroid) {
  if (onAndroid) return Boolean(adbOut(androidTools(), ['shell', 'pidof', EXPO_GO_ANDROID]));
  return expoGoRunning(capture('xcrun', ['simctl', 'spawn', device, 'launchctl', 'list']) ?? '');
}

export const API_STATES = ['up', 'paused', 'stopped'];

export function apiMoves(from, to) {
  if (from === to) return [];
  const up = {
    paused: [['unpause', 'api']],
    stopped: [['up', '-d', '--wait', '--no-recreate', 'api']],
  };
  if (to === 'up') return up[from];
  if (from !== 'up') return [...up[from], ...apiMoves('up', to)];
  return [[to === 'paused' ? 'pause' : 'stop', 'api']];
}

export const apiStateOf = (containerState) =>
  ({ running: 'up', paused: 'paused' })[containerState.trim()] ?? 'stopped';

// A check holds Event View's reads by pausing the API once the list has loaded. Each move waits
// for the one before it. The state is read from Docker on the first move and after a failed one,
// since a killed batch or a half-done move leaves the container in a state nobody recorded.
export function apiControl({ run, read }) {
  let state;
  let moving = Promise.resolve();
  const move = (to) => {
    const next = moving.then(async () => {
      state ??= apiStateOf(await read());
      for (const args of apiMoves(state, to)) {
        if (!(await run(args))) {
          state = undefined;
          throw new Error(`docker compose ${args.join(' ')} failed`);
        }
        state = args[0] === 'pause' ? 'paused' : args[0] === 'stop' ? 'stopped' : 'up';
      }
    });
    moving = next.catch(() => {});
    return next;
  };
  return { move, state: () => state };
}

const composeApi = (root) =>
  apiControl({
    run: (args) => runAsync('docker', ['compose', ...args], { cwd: root }),
    read: () =>
      capture('docker', ['compose', 'ps', '-a', 'api', '--format', '{{.State}}'], { cwd: root }) ??
      '',
  });

const within = (ms, promise) =>
  Promise.race([promise.then(() => true), pause(ms).then(() => false)]);

// Under ten seconds an answer: batch/helper.js asks again while this says wait. A check that
// failed while it held the API leaves it held, its last move perhaps still running, so whatever
// uses the API next queues an 'up' behind it.
export function startHelper({
  email,
  secret,
  setLocale,
  apiState,
  passed,
  begun,
  heard,
  device,
  onAndroid,
  open = openOnEmulator,
  port = CONFIG.helperPort,
}) {
  const server = createServer(async (request, response) => {
    heard.at = Date.now();
    const url = new URL(request.url ?? '/', 'http://helper');
    const reply = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === '/code') {
        if (!secret) throw new Error('this batch was given no TOTP_SECRET');
        if (codeStep(Date.now(), usedSteps().used[email]).waitMs > 8000) {
          await pause(8000);
          return reply(200, { wait: true });
        }
        return reply(200, { code: await nextCode(email, secret) });
      }
      if (url.pathname === '/reload') {
        await reloadApp();
        return reply(200, { reloaded: true });
      }
      if (url.pathname === '/running') {
        return reply(200, { running: appRunning(device, onAndroid) });
      }
      if (url.pathname === '/language') {
        const locale = url.searchParams.get('to');
        if (!(await within(8000, apiState.move('up')))) return reply(200, { wait: true });
        await setLocale(locale);
        return reply(200, { language: locale });
      }
      if (url.pathname === '/api') {
        const to = url.searchParams.get('to');
        if (!API_STATES.includes(to))
          throw new Error(`no API state ${to}: ${API_STATES.join(', ')}`);
        if (!(await within(8000, apiState.move(to)))) return reply(200, { wait: true });
        return reply(200, { api: to });
      }
      if (url.pathname === '/started') {
        if (!(await within(8000, apiState.move('up')))) return reply(200, { wait: true });
        begun.push(url.searchParams.get('check'));
        return reply(200, {});
      }
      if (url.pathname === '/open') {
        const path = url.searchParams.get('path') ?? '';
        if (path && !path.startsWith('/'))
          throw new Error(`open what? /open?path=/--/… gave ${path}`);
        open(`${CONFIG.urls.metro}${path}`);
        return reply(200, { opened: path });
      }
      if (url.pathname === '/passed') {
        passed.add(url.searchParams.get('check'));
        return reply(200, {});
      }
      return reply(404, { error: `nothing at ${url.pathname}` });
    } catch (error) {
      return reply(500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  return new Promise((ready, failed) => {
    server.once('error', failed);
    server.listen(port, '127.0.0.1', () => ready(server));
  });
}

// A dead driver either ends Maestro at once or hangs it. For the hang a run gets a budget, and a
// batch whose flows stop calling the harness for STALL_MS is stopped sooner.
export const runBudgetMs = (runs) => (5 + 2 * runs) * 60_000;
export const STALL_MS = 5 * 60_000;

export function runAsync(command, args, { cwd, env, timeoutMs, stall }) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    const stop = (why) => {
      console.error(`\n${command} ${why}: stopped.`);
      child.kill('SIGKILL');
    };
    const timer =
      timeoutMs &&
      setTimeout(() => stop(`still running after ${timeoutMs / 60_000} minutes`), timeoutMs);
    const watchdog =
      stall &&
      setInterval(
        () => {
          if (Date.now() - stall.heard.at < stall.ms) return;
          stall.stalled = true;
          stop(`has not reached the harness for ${Math.round(stall.ms / 1000)} s`);
        },
        Math.min(stall.ms, 10_000),
      );
    const finish = (ok) => {
      clearTimeout(timer);
      clearInterval(watchdog);
      done(ok);
    };
    child.on('exit', (code) => finish(code === 0));
    child.on('error', () => finish(false));
  });
}

function catalogues(root) {
  const dir = join(root, 'apps/mobile/src/i18n/locales');
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => [basename(name, '.json'), JSON.parse(readFileSync(join(dir, name), 'utf8'))]),
  );
}

async function batch(args) {
  const root = qaWorktree();
  const onAndroid = args.includes('--android');
  const { name, checks, languages, vars, cold } = parseBatch(args);
  const { EMAIL: email, PASSWORD: password, TOTP_SECRET: secret, ...rest } = vars;
  if (!email || !password) throw new Error('whose batch? EMAIL=… PASSWORD=…, from `account`');
  const source = join(root, 'apps/mobile/.maestro');
  const missing = checks.filter((check) => !existsSync(join(source, 'checks', `${check}.yaml`)));
  if (missing.length) throw new Error(`no ${missing.join(', ')} in apps/mobile/.maestro/checks`);
  const device = maestroDevice(args);
  if (!onAndroid && !passwordAutoFillIsOff(device)) {
    throw new Error(
      'this simulator still offers to save a password — run `ios` first, which turns it off',
    );
  }

  const out = join(root, '.qa', name);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const flows = join(root, '.qa/.batch', name);
  composeBatch(source, flows, {
    checks,
    languages,
    cold,
    catalogues: catalogues(root),
    email,
    onAndroid,
  });

  const apiState = composeApi(root);
  await apiState.move('up');
  const named = languages[0] !== 'any';
  const token = named ? await apiSession(email, password, secret) : null;
  const before = named ? (await api('/api/auth/me', { method: 'GET', token })).locale : null;
  const passed = new Set();
  const begun = [];
  const heard = { at: Date.now() };
  const crashed = [];
  const setLocale = async (locale) => {
    await apiState.move('up');
    await api('/api/auth/locale', { method: 'PUT', token, body: { locale } });
  };
  const helper = await startHelper({
    email,
    secret,
    setLocale,
    apiState,
    passed,
    begun,
    heard,
    device,
    onAndroid,
  });
  // The secret stays with the helper: no flow is handed it.
  const env = {
    METRO_URL: CONFIG.urls.metro,
    MAILPIT_URL: CONFIG.urls.mailpit,
    HELPER_URL: `http://127.0.0.1:${CONFIG.helperPort}`,
    EMAIL: email,
    PASSWORD: password,
    ORG_NAME: ACCOUNT_ORGANISATION,
    ...rest,
  };
  const test = async (flow, held) => {
    await apiState.move('up');
    const from = begun.length;
    heard.at = Date.now();
    const stall = { ms: STALL_MS, heard };
    await runAsync(
      maestroBin() ?? 'maestro',
      [
        ...maestroTarget(device, onAndroid, CONFIG.driverPort),
        'test',
        '--debug-output',
        out,
        ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
        flow,
      ],
      {
        cwd: root,
        env: onAndroid ? androidTools().env : {},
        timeoutMs: runBudgetMs(held.length),
        stall,
      },
    );
    const after = afterRun(held, { begun, from, passed, stalled: stall.stalled });
    if (after.crashed) crashed.push(after.crashed);
    return after;
  };

  const started = Date.now();
  try {
    if (cold) {
      for (const language of languages) {
        for (const check of checks) {
          if (named) await setLocale(language);
          await test(join(flows, `_cold.${checkId(check, language)}.yaml`), [{ check, language }]);
        }
      }
    } else {
      if (named) await setLocale(languages[0]);
      const first = await test(join(flows, '_batch.yaml'), batchRuns(checks, languages));
      // After a driver crash the checks it never reached run in a fresh Maestro.
      await resumeBatch(first.rest, async (rest, attempt) => {
        const flow = join(flows, `_rest.${attempt}.yaml`);
        const written = batchFlow({ runs: rest });
        writeFileSync(flow, onAndroid ? forAndroid(written) : written);
        if (named) await setLocale(rest[0].language);
        return test(flow, rest);
      });
    }
  } finally {
    helper.close();
    await apiState
      .move('up')
      .catch((error) => console.error(`\nThe API is still held: ${error.message}`));
    // The app follows the account's language when it next opens, and later flows expect English.
    if (named) await setLocale(before ?? 'en');
  }
  const seconds = Math.round((Date.now() - started) / 1000);

  spawnSync('sh', ['-c', `find "${out}" -mindepth 2 -name '*.png' -exec cp {} "${out}/" \\;`]);
  const runs = batchRuns(checks, languages);
  const ids = runs.map(({ check, language }) => checkId(check, language));
  const failed = ids.filter((id) => !passed.has(id));
  console.log(
    `\nBatch ${name}${cold ? ', each check alone and cold' : ''}: ` +
      `${ids.length - failed.length} passed, ${failed.length} failed, in ${Math.floor(seconds / 60)}m${seconds % 60}s`,
  );
  for (const line of batchSummary(ids, { passed, begun, crashed })) console.log(`  ${line}`);
  console.log(`Evidence in ${out}`);
  if (failed.length) {
    const failures = runs.filter(({ check, language }) => !passed.has(checkId(check, language)));
    console.log('Re-run each alone, cold:');
    for (const hint of rerunHints(name, failures, { args, email, secret, rest }))
      console.log(`  ${hint}`);
    process.exitCode = 1;
  }
}

export const MAX_RESUMES = 3;

export async function resumeBatch(rest, resume) {
  for (let attempt = 1; rest.length && attempt <= MAX_RESUMES; attempt++)
    ({ rest } = await resume(rest, attempt));
}

// Checks are optional, so a run that ends before the last check it held, or that the watchdog
// stopped, lost its driver. It blames the last check it began if that one did not pass, and
// resumes past it.
export function afterRun(held, { begun, from, passed, stalled = false }) {
  const current = begun.slice(from).at(-1);
  const rest = held.filter(({ check, language }) => !begun.includes(checkId(check, language)));
  if (!current) return { crashed: null, rest: [] };
  const lost = rest.length > 0 || stalled;
  return { crashed: lost && !passed.has(current) ? current : null, rest };
}

export function batchSummary(ids, { passed, begun, crashed }) {
  return ids.map((id) => {
    if (passed.has(id)) return `✓ ${id}`;
    if (crashed.includes(id)) return `✗ ${id}: Maestro's driver stopped answering (a driver crash)`;
    if (!begun.includes(id)) return `✗ ${id}: not run`;
    return `✗ ${id}`;
  });
}

export function rerunHints(name, failures, { args, email, secret, rest = {} }) {
  const device = ['--ipad', '--android'].filter((flag) => args.includes(flag));
  return failures.map(({ check, language }) =>
    [
      'node .qa/bin/qa-env.mjs batch',
      `${name}-${checkId(check, language).replace('.', '-')}`,
      check,
      ...(language === 'any' ? [] : ['--lang', language]),
      '--cold',
      ...device,
      `EMAIL=${email}`,
      'PASSWORD=…',
      ...(secret ? ['TOTP_SECRET=…'] : []),
      ...Object.entries(rest).map(([key, value]) =>
        /^[\w@%+=:,./-]*$/.test(value)
          ? `${key}=${value}`
          : `'${key}=${value.replaceAll("'", "'\\''")}'`,
      ),
    ].join(' '),
  );
}

// --ready finishes Complete your profile and founds one organisation; --two-factor also turns it on.
async function account(args) {
  const root = qaWorktree();
  const env = { SOIRELY_API_URL: CONFIG.urls.api, MAILPIT_URL: CONFIG.urls.mailpit };
  const twoFactor = args.includes('--two-factor');
  if (!twoFactor && !args.includes('--ready')) {
    run('node', ['scripts/qa-account.mjs', ...args], { cwd: root, env });
    return;
  }
  const passed = args.filter((a) => a !== '--two-factor' && a !== '--ready');
  const made = capture('node', ['scripts/qa-account.mjs', '--json', ...passed], {
    cwd: root,
    env: { ...process.env, ...env },
  });
  if (made === null) throw new Error('scripts/qa-account.mjs registered no account');
  const { email, password, name, accessToken: token } = JSON.parse(made);
  await api('/api/auth/complete-profile', {
    method: 'PATCH',
    token,
    body: {
      name,
      organisationName: ACCOUNT_ORGANISATION,
      countryCode: 'GB',
      timezone: 'Europe/London',
    },
  });
  const lines = [`  email        ${email}`, `  password     ${password}`];
  let secret = null;
  if (twoFactor) {
    ({ secret } = await api('/api/auth/two-factor/enrol', { token }));
    const code = await nextCode(email, secret);
    await api('/api/auth/two-factor/activate', { token, body: { code } });
    lines.push(`  TOTP_SECRET  ${secret}`);
  }
  console.log(
    `\n▸ registered, profile complete, owning QA Organisation${twoFactor ? ', two-factor on' : ''}` +
      `\n\n${lines.join('\n')}\n\nbatch <name> <check>… EMAIL=${email} PASSWORD=${password}` +
      `${secret ? ` TOTP_SECRET=${secret}` : ''}\n`,
  );
}

function chrome() {
  run('open', [
    '-na',
    'Google Chrome',
    '--args',
    `--remote-debugging-port=${CONFIG.chromePort}`,
    `--user-data-dir=${join(homedir(), `.cache/${CONFIG.project}-chrome`)}`,
    '--no-first-run',
    '--no-default-browser-check',
    CONFIG.urls.web,
  ]);
}

const COMMANDS = {
  setup,
  checkout,
  status,
  ios,
  android,
  release,
  link,
  maestro,
  batch,
  hierarchy,
  account,
  chrome,
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf('--tester');
  if (flag !== -1) {
    const asked = Number(argv[flag + 1]);
    if (INSTALLED && asked !== CONFIG.tester) {
      console.error(`this harness belongs to tester ${CONFIG.tester}, not ${argv[flag + 1]}`);
      process.exit(2);
    }
    CONFIG = qaConfig(asked);
    argv.splice(flag, 2);
  }
  const [name, ...args] = argv;
  const command = COMMANDS[name ?? 'status'];
  if (!command) {
    console.error(`unknown command ${name}. One of: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(2);
  }
  try {
    await command(args);
  } catch (error) {
    process.stderr.write(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
