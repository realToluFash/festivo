import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  allowCleartext,
  batchCheck,
  batchFlow,
  checkId,
  codeStep,
  composeBatch,
  localise,
  parseBatch,
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
  expoGoApk,
  expoSdkMajor,
  forAndroid,
  linkIntent,
  maestroTarget,
  parseTarget,
  playImage,
  QA_OVERRIDES,
  QA_PORTS,
  qaConfig,
  releaseApk,
  staleApks,
  renderQaEnv,
  reversedPorts,
  simulatorFor,
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

describe('the simulator ios opens', () => {
  it.each([
    [[], { open: 'phone', shut: 'ipad' }],
    [['--phone'], { open: 'phone', shut: 'ipad' }],
    [['--ipad'], { open: 'ipad', shut: 'phone' }],
  ])('%j opens one and shuts the other', (args, expected) => {
    expect(simulatorFor(args)).toEqual(expected);
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
      staleApks(
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
  it('is gone, and the rest of var stays', () => {
    const root = mkdtempSync(join(tmpdir(), 'qa-cache-'));
    mkdirSync(join(root, 'services/api/var/cache/dev'), { recursive: true });
    writeFileSync(join(root, 'services/api/var/cache/dev/App_KernelDevDebugContainer.php'), '');
    mkdirSync(join(root, 'services/api/var/log'), { recursive: true });

    clearApiCache(root);

    expect(existsSync(join(root, 'services/api/var/cache'))).toBe(false);
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
      'Signed in as qa-1@soirely\\.test',
    );
    expect(localise('{{t:settings.signedInAs}}', catalogues, 'en', values)).toBe('Signed in as .*');
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

  it('starts from a reload, names its screenshots for itself, and reports it passed', () => {
    expect(batchCheck(flow, 'settings', 'es', { reset: true })).toBe(
      [
        'appId: host.exp.Exponent',
        '---',
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
    const checks = [
      'home',
      'settings',
      'account',
      'security',
      'organisation',
      'members',
      'roles',
      'sign-in-rules',
      'switcher',
      'create-organisation',
    ];
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
      expect(readFileSync(join(target, 'batch/session.yaml'), 'utf8')).not.toContain('{{t:');
      expect(readFileSync(join(target, 'sign-in.yaml'), 'utf8')).toContain('stopApp: true');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});
