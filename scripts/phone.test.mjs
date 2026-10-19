import { describe, expect, it } from 'vitest';

import { lanAddress, parseEnv, phoneConfig } from './phone.mjs';

const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });

describe('the address the phone reaches', () => {
  it('is the Wi-Fi one, past Docker, VMware, a VPN and a wired port on another network', () => {
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

  it('falls back to a wired address when there is no Wi-Fi', () => {
    expect(lanAddress({ docker0: [v4('172.17.0.1')], eth0: [v4('10.0.0.5')] })).toBe('10.0.0.5');
  });

  it('is none when only public or virtual addresses exist', () => {
    expect(lanAddress({ eth0: [v4('203.0.113.4')], docker0: [v4('172.17.0.1')] })).toBeNull();
  });
});

describe('the stack and the bundle, pointed at that address', () => {
  const env = parseEnv(
    [
      'API_PORT=58080',
      'METRO_PORT=58081',
      'OIDC_PORT=58089',
      'MERCURE_PORT=53000',
      'STORAGE_PORT=54566',
      'SMS_AUTH_TOKEN=development-token          # CHANGE IN PRODUCTION',
      'OAUTH_GOOGLE_ISSUERS=http://127.0.0.1:58089/google,http://oidc:8080/google',
      'OAUTH_APPLE_ISSUERS=http://127.0.0.1:58089/apple,https://appleid.apple.com',
    ].join('\n'),
  );
  const config = phoneConfig(env, '192.168.1.221');

  it('reads .env as compose does, without the trailing comment', () => {
    expect(env.SMS_AUTH_TOKEN).toBe('development-token');
  });

  it('keeps sign-in from this machine working beside sign-in from the phone', () => {
    expect(config.stack.OAUTH_GOOGLE_ISSUERS).toBe(
      'http://127.0.0.1:58089/google,http://oidc:8080/google,http://192.168.1.221:58089/google',
    );
    expect(config.stack.OAUTH_APPLE_ISSUERS.split(',')).toContain('https://appleid.apple.com');
    expect(phoneConfig({ ...env, ...config.stack }, '192.168.1.221').stack).toEqual(config.stack);
  });

  it('gives the bundle no localhost, which on a phone is the phone', () => {
    expect(Object.values(config.expo).join(' ')).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(config.expo.EXPO_PUBLIC_API_URL).toBe('http://192.168.1.221:58080');
    expect(config.url).toBe('exp://192.168.1.221:58081');
  });
});
