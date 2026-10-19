#!/usr/bin/env node
// The app in Expo Go on a real phone on this network, at the latest main. How: CONTRIBUTING.md.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expoGoApk } from './qa-env.mjs';

const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
// Docker, VMware, VPN and bridge interfaces carry private addresses no phone can reach.
const VIRTUAL = /^(docker|br-|veth|vmnet|virbr|tun|tap|utun|wg|lo)/;

export function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/\s+#.*$/, '').trim();
  }
  return env;
}

// Wi-Fi first: a phone joins the wireless network, and a laptop's wired port is often another one.
export function lanAddress(interfaces) {
  const candidates = Object.entries(interfaces)
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && PRIVATE.test(a.address))
        .map((a) => ({ name, address: a.address })),
    );
  const wireless = candidates.find(({ name }) => /^(wl|en0$)/.test(name));
  return (wireless ?? candidates[0])?.address ?? null;
}

export function phoneConfig(env, host) {
  const at = (port) => `http://${host}:${env[port]}`;
  const oidc = at('OIDC_PORT');
  const withIssuer = (list, path) =>
    [...new Set([...(list ?? '').split(',').filter(Boolean), `${oidc}/${path}`])].join(',');
  return {
    stack: {
      MERCURE_PUBLIC_URL: `${at('MERCURE_PORT')}/.well-known/mercure`,
      STORAGE_PUBLIC_ENDPOINT: at('STORAGE_PORT'),
      OAUTH_GOOGLE_ISSUERS: withIssuer(env.OAUTH_GOOGLE_ISSUERS, 'google'),
      OAUTH_APPLE_ISSUERS: withIssuer(env.OAUTH_APPLE_ISSUERS, 'apple'),
    },
    expo: {
      REACT_NATIVE_PACKAGER_HOSTNAME: host,
      EXPO_PUBLIC_API_URL: at('API_PORT'),
      EXPO_PUBLIC_ENVIRONMENT: 'phone',
      EXPO_PUBLIC_GOOGLE_AUTHORIZE_URL: `${oidc}/google/authorize`,
      EXPO_PUBLIC_GOOGLE_TOKEN_URL: `${oidc}/google/token`,
      EXPO_PUBLIC_APPLE_AUTHORIZE_URL: `${oidc}/apple/authorize`,
      EXPO_PUBLIC_APPLE_TOKEN_URL: `${oidc}/apple/token`,
    },
    ports: ['API_PORT', 'METRO_PORT', 'OIDC_PORT', 'MERCURE_PORT', 'STORAGE_PORT'].map(
      (key) => env[key],
    ),
    url: `exp://${host}:${env.METRO_PORT}`,
  };
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

// A developer's branch is work in progress; only a detached, clean checkout is moved to main.
function latestMain() {
  step('The latest main');
  if (git(['status', '--porcelain']))
    throw new Error('uncommitted changes here: commit or move them first');
  const branch = git(['branch', '--show-current']);
  if (branch)
    throw new Error(
      `this checkout is on ${branch}: run it from a detached one, such as ../soirely-ops`,
    );
  git(['fetch', '--quiet', 'origin']);
  git(['checkout', '--quiet', '--detach', 'origin/main']);
  console.log(`  ${git(['log', '-1', '--format=%h %s'])}`);
}

function stack(config) {
  step('The stack, reachable from the phone');
  run('node', ['scripts/setup.mjs']);
  // The shell's values win over .env, so a plain `docker compose up` puts the stack back on localhost.
  run('docker', ['compose', 'up', '-d', '--build', '--wait', 'api'], { env: config.stack });
  const console_ = ['compose', 'exec', '-T', 'api', 'php', 'bin/console'];
  run('docker', [...console_, 'lexik:jwt:generate-keypair', '--skip-if-exists']);
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

async function main() {
  const host = process.argv[2] ?? lanAddress(networkInterfaces());
  if (!host)
    throw new Error('no address on a private network: pass one, `just phone 192.168.1.20`');
  const env = parseEnv(readFileSync(join(ROOT, '.env'), 'utf8'));
  const config = phoneConfig(env, host);

  latestMain();
  stack(config);

  const apk = await expoGoLink();
  step('On the phone, on the same network');
  console.log(
    `  1. Expo Go ${apk ? `${apk.version}, the build for this SDK: ${apk.url}` : 'for this SDK'}`,
  );
  console.log(`  2. Enter URL manually: ${config.url}`);
  console.log(
    `  Codes: email at http://localhost:${env.MAILPIT_UI_PORT}, SMS at http://localhost:${env.SMOCKER_UI_PORT} (History)`,
  );
  console.log(`  Nothing loads? Open the firewall to the network:`);
  console.log(
    `    sudo ufw allow from ${host.replace(/\.\d+$/, '.0/24')} to any port ${config.ports.join(',')} proto tcp`,
  );

  step('Metro, until Ctrl-C');
  run('npx', ['expo', 'start', '--lan', '--port', env.METRO_PORT, '--clear'], {
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
