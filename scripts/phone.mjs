#!/usr/bin/env node
// The app in Expo Go on a real phone on this network, at the latest main. How: CONTRIBUTING.md.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleConfig, roleOf, startStack, writeEnv } from './dev-env.mjs';
import { DEVELOPMENT_PORTS, expoGoApk, networkAddress, stackConfig } from './qa-env.mjs';

export function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/\s+#.*$/, '').trim();
  }
  return env;
}

// On a Mac, en0 is Wi-Fi on a laptop and Ethernet on a desktop: only networksetup knows which.
export function wifiDevices(hardwarePorts) {
  return [...hardwarePorts.matchAll(/Hardware Port: (?:Wi-Fi|AirPort)\nDevice: (\S+)/g)].map(
    (match) => match[1],
  );
}

// Every other override follows the phone, so a key added to stackConfig needs nothing here.
export const KEPT = ['COMPOSE_PROJECT_NAME', ...Object.keys(DEVELOPMENT_PORTS)];

export function phoneConfig(env, address) {
  const offset = Number(env.API_PORT ?? DEVELOPMENT_PORTS.API_PORT) - DEVELOPMENT_PORTS.API_PORT;
  const here = stackConfig(env.COMPOSE_PROJECT_NAME, offset);
  const phone = stackConfig(env.COMPOSE_PROJECT_NAME, offset, address);
  const oidc = phone.ports.OIDC_PORT;
  const issuers = (key, path) =>
    [
      ...new Set(
        [
          ...(env[key] ?? '').split(','),
          `http://localhost:${oidc}/${path}`,
          ...here.overrides[key].split(','),
          ...phone.overrides[key].split(','),
        ].filter(Boolean),
      ),
    ].join(',');
  return {
    // Meanwhile Apple on an emulator against 127.0.0.1 fails; a plain `just up` restores it.
    stack: {
      ...Object.fromEntries(Object.entries(phone.overrides).filter(([key]) => !KEPT.includes(key))),
      OAUTH_GOOGLE_ISSUERS: issuers('OAUTH_GOOGLE_ISSUERS', 'google'),
      OAUTH_APPLE_ISSUERS: issuers('OAUTH_APPLE_ISSUERS', 'apple'),
    },
    expo: {
      ...phone.app,
      REACT_NATIVE_PACKAGER_HOSTNAME: address,
      EXPO_PUBLIC_ENVIRONMENT: 'phone',
    },
    ports: phone.ports,
    url: phone.urls.metro,
    codes: { mail: here.urls.mailpit, sms: here.urls.smocker },
  };
}

// .env.example's ports are the main checkout's, so a stack started from it collides with it.
export function envSource(root, hasEnv) {
  if (hasEnv) return null;
  const role = roleOf(root);
  if (!role) {
    throw new Error(
      'no .env here: run it from a role worktree, such as one `just dev-env setup --role ops` makes',
    );
  }
  return role;
}

export function firewallAdvice(platform, address, ports) {
  if (platform === 'darwin') {
    return [
      'macOS lets apps through its firewall, not ports. In System Settings › Network › Firewall,',
      'allow incoming connections for node (Metro) and Docker Desktop, or turn the firewall off.',
    ];
  }
  const open = ['API_PORT', 'METRO_PORT', 'OIDC_PORT', 'MERCURE_PORT', 'STORAGE_PORT'];
  return [
    `sudo ufw allow from ${address.replace(/\.\d+$/, '.0/24')} to any port ${open.map((key) => ports[key]).join(',')} proto tcp`,
  ];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function run(command, args, { cwd = ROOT, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

function step(label) {
  process.stdout.write(`\n▸ ${label}\n`);
}

function latestMain() {
  step('The latest main');
  if (git(['status', '--porcelain'])) {
    throw new Error('uncommitted changes here: commit or move them first');
  }
  const branch = git(['branch', '--show-current']);
  if (branch) {
    throw new Error(
      `this checkout is on ${branch}: run it from a detached one, such as ../soirely-ops`,
    );
  }
  git(['fetch', '--quiet', 'origin']);
  git(['checkout', '--quiet', '--detach', 'origin/main']);
  console.log(`  ${git(['log', '-1', '--format=%h %s'])}`);
}

function address() {
  if (process.argv[2]) return process.argv[2];
  const ports =
    process.platform === 'darwin'
      ? (spawnSync('networksetup', ['-listallhardwareports'], { encoding: 'utf8' }).stdout ?? '')
      : '';
  const found = networkAddress(networkInterfaces(), wifiDevices(ports));
  if (!found)
    throw new Error('no address on a private network: pass one, `just phone 192.168.1.20`');
  return found;
}

function stack(config) {
  step('The stack, reachable from the phone');
  // The shell's values win over .env, so a plain `docker compose up` puts the stack back on localhost.
  startStack(ROOT, config.stack);
  const console_ = ['compose', 'exec', '-T', 'api', 'php', 'bin/console'];
  run('docker', [...console_, 'lexik:jwt:generate-keypair', '--skip-if-exists']);
  run('docker', [...console_, 'doctrine:database:create', '--if-not-exists']);
  run('docker', [...console_, 'doctrine:migrations:migrate', '-n', '--allow-no-migration']);
}

async function expoGoLink() {
  const expo = JSON.parse(readFileSync(join(ROOT, 'apps/mobile/package.json'), 'utf8')).dependencies
    .expo;
  try {
    const versions = await fetch('https://api.expo.dev/v2/versions').then((r) => r.json());
    return expoGoApk(versions, expo);
  } catch {
    return null;
  }
}

// A moved checkout has a newer stackConfig than the one loaded here, so the newer script runs.
function rerunIfMoved(before) {
  if (git(['rev-parse', 'HEAD']) === before) return;
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, SOIRELY_PHONE_MOVED: '1' },
    },
  );
  process.exit(result.status ?? 1);
}

async function main() {
  const host = address();
  if (!process.env.SOIRELY_PHONE_MOVED) {
    const before = git(['rev-parse', 'HEAD']);
    latestMain();
    rerunIfMoved(before);
  }
  const role = envSource(ROOT, existsSync(join(ROOT, '.env')));
  if (role) {
    step(`The ${role} stack's environment`);
    writeEnv(ROOT, roleConfig(role));
  }
  run('node', ['scripts/setup.mjs']);
  const config = phoneConfig(parseEnv(readFileSync(join(ROOT, '.env'), 'utf8')), host);
  stack(config);

  const apk = await expoGoLink();
  step('On the phone, on the same network');
  console.log(
    `  1. Expo Go ${apk ? `${apk.version}, the build for this SDK: ${apk.url}` : 'for this SDK'}`,
  );
  console.log(`  2. Enter URL manually: ${config.url}`);
  console.log(`  Codes: email at ${config.codes.mail}, SMS at ${config.codes.sms} (History)`);
  console.log('  Nothing loads? Let the phone through the firewall:');
  for (const line of firewallAdvice(process.platform, host, config.ports))
    console.log(`    ${line}`);

  step('Metro, until Ctrl-C');
  run('npx', ['expo', 'start', '--lan', '--port', String(config.ports.METRO_PORT), '--clear'], {
    cwd: join(ROOT, 'apps/mobile'),
    env: config.expo,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
