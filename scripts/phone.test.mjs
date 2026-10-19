import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { renderDevEnv, roleConfig } from './dev-env.mjs';
import {
  envSource,
  firewallAdvice,
  KEPT,
  lanAddress,
  parseEnv,
  phoneConfig,
  wifiDevices,
} from './phone.mjs';
import { stackConfig } from './qa-env.mjs';

const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });

describe('the address the phone reaches', () => {
  it('is the Wi-Fi one on Linux, past Docker, VMware, a VPN and a wired port', () => {
    expect(
      lanAddress({
        lo: [v4('127.0.0.1', true)],
        docker0: [v4('172.17.0.1')],
        vmnet8: [v4('172.16.65.1')],
        tun0: [v4('192.168.240.112')],
        enp89s0: [v4('192.168.132.130')],
        wlp88s0: [v4('192.168.1.221'), { family: 'IPv6', address: 'fe80::1', internal: false }],
      }),
    ).toBe('192.168.1.221');
  });

  it('is the Wi-Fi device networksetup names on a Mac desktop, where en0 is Ethernet', () => {
    const hardwarePorts = [
      'Hardware Port: Ethernet',
      'Device: en0',
      'Ethernet Address: 00:00:00:00:00:01',
      '',
      'Hardware Port: Wi-Fi',
      'Device: en1',
      'Ethernet Address: 00:00:00:00:00:02',
    ].join('\n');
    expect(wifiDevices(hardwarePorts)).toEqual(['en1']);
    expect(
      lanAddress(
        {
          bridge100: [v4('192.168.64.1')],
          awdl0: [v4('169.254.1.1')],
          utun3: [v4('10.8.0.2')],
          en0: [v4('192.168.50.10')],
          en1: [v4('192.168.1.164')],
        },
        wifiDevices(hardwarePorts),
      ),
    ).toBe('192.168.1.164');
  });

  it('skips a Mac’s shared-network bridge when Wi-Fi has no address', () => {
    expect(lanAddress({ bridge100: [v4('192.168.64.1')], en0: [v4('10.0.0.5')] })).toBe('10.0.0.5');
  });

  it('is none when only public or virtual addresses exist', () => {
    expect(lanAddress({ eth0: [v4('203.0.113.4')], docker0: [v4('172.17.0.1')] })).toBeNull();
  });
});

describe('the stack and the bundle, pointed at that address', () => {
  const role = parseEnv(
    [
      'COMPOSE_PROJECT_NAME=soirely-ops',
      'API_PORT=58080',
      'SMS_AUTH_TOKEN=development-token          # CHANGE IN PRODUCTION',
      'OAUTH_GOOGLE_ISSUERS=http://127.0.0.1:58089/google,http://oidc:8080/google',
      'OAUTH_APPLE_ISSUERS=http://127.0.0.1:58089/apple,https://appleid.apple.com',
    ].join('\n'),
  );
  const config = phoneConfig(role, '192.168.1.221');

  it('reads .env as compose does, without the trailing comment', () => {
    expect(role.SMS_AUTH_TOKEN).toBe('development-token');
  });

  it('works from the .env a role worktree is given, on that role’s ports', () => {
    const written = renderDevEnv(readFileSync('.env.example', 'utf8'), roleConfig('ops'));
    const fresh = phoneConfig(parseEnv(written), '192.168.1.164');
    expect(fresh.url).toBe('exp://192.168.1.164:58081');
    expect(fresh.ports.POSTGRES_PORT).toBe(55432);
    expect(fresh.stack.OAUTH_GOOGLE_ISSUERS.split(',')).toContain('http://localhost:58089/google');
  });

  it('writes a role’s .env where there is none, and refuses outside a role worktree', () => {
    expect(envSource('/home/me/Projects/soirely-ops', true)).toBeNull();
    expect(envSource('/home/me/Projects/soirely-ops', false)).toBe('ops');
    expect(envSource('/home/me/Projects/soirely-lead', false)).toBe('lead');
    expect(() => envSource('/home/me/Projects/soirely', false)).toThrow(
      /just dev-env setup --role ops/,
    );
  });

  it('finds a role’s ports from its API port', () => {
    expect(config.url).toBe('exp://192.168.1.221:58081');
    expect(config.expo.EXPO_PUBLIC_API_URL).toBe('http://192.168.1.221:58080');
  });

  it('keeps sign-in from this machine working beside sign-in from the phone', () => {
    expect(config.stack.OAUTH_GOOGLE_ISSUERS.split(',')).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:58089/google',
        'http://oidc:8080/google',
        'http://192.168.1.221:58089/google',
      ]),
    );
    expect(config.stack.OAUTH_APPLE_ISSUERS.split(',')).toContain('https://appleid.apple.com');
    expect(phoneConfig({ ...role, ...config.stack }, '192.168.1.221').stack).toEqual(config.stack);
  });

  it('moves every stack setting that names this machine, but the project and its ports', () => {
    const named = Object.entries(stackConfig('soirely-ops', 50000, '192.168.1.221').overrides)
      .filter(([, value]) => String(value).includes('192.168.1.221'))
      .map(([key]) => key);
    expect(named.filter((key) => !(key in config.stack) && !KEPT.includes(key))).toEqual([]);
    expect(config.stack.OAUTH_APPLE_RETURN_URI).toBe(
      'http://192.168.1.221:58080/api/auth/oauth/apple/return',
    );
    expect(Object.keys(config.stack)).not.toContain('API_PORT');
    expect(Object.keys(config.stack)).not.toContain('COMPOSE_PROJECT_NAME');
  });

  it('gives the bundle every app setting the stacks have, and none on localhost', () => {
    expect(Object.keys(config.expo)).toEqual(
      expect.arrayContaining(Object.keys(stackConfig('soirely-ops', 50000).app)),
    );
    expect(Object.values(config.expo).join(' ')).not.toMatch(/localhost|127\.0\.0\.1/);
  });
});

describe('the firewall advice', () => {
  const { ports } = stackConfig('soirely-ops', 50000);

  it('is a ufw rule for the network on Linux', () => {
    expect(firewallAdvice('linux', '192.168.1.221', ports)).toEqual([
      'sudo ufw allow from 192.168.1.0/24 to any port 58080,58081,58089,53000,54566 proto tcp',
    ]);
  });

  it('is about apps, not ports, on macOS, where there is no ufw', () => {
    const advice = firewallAdvice('darwin', '192.168.1.164', ports).join(' ');
    expect(advice).not.toMatch(/ufw/);
    expect(advice).toMatch(/node/);
    expect(advice).toMatch(/Docker Desktop/);
  });
});
