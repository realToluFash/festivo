import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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
  apiControl,
  apiMoves,
  apiStateOf,
  batchCheck,
  batchFlow,
  batchRuns,
  afterRun,
  batchSummary,
  bundlerEnv,
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
  runAsync,
  runBudgetMs,
  startHelper,
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
  expoGoRunning,
  expoSdkMajor,
  forAndroid,
  openIntent,
  linkIntent,
  MAX_RESUMES,
  renewingSession,
  resumeBatch,
  maestroTarget,
  parseTarget,
  passwordAutoFillFiles,
  passwordAutoFillOff,
  playImage,
  QA_OVERRIDES,
  QA_PORTS,
  qaConfig,
  APP_SERVICES,
  launchVideo,
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
    }
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

  it('goes through up between paused and stopped, since a paused container is not stopped', () => {
    expect(apiMoves('paused', 'stopped')).toEqual([
      ['unpause', 'api'],
      ['stop', 'api'],
    ]);
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

function dockerDouble(container, { failing = [] } = {}) {
  const ran = [];
  const control = apiControl({
    read: async () => container,
    run: async (args) => {
      ran.push(args.join(' '));
      return !failing.includes(args[0]);
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
    expect(ran).toEqual(['pause api', 'unpause api', 'stop api', 'up -d --wait --no-recreate api']);
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

  it('reads Docker again after a move that failed, and the next move still runs', async () => {
    const { control, ran } = dockerDouble('running', { failing: ['stop'] });
    await expect(control.move('stopped')).rejects.toThrow('docker compose stop api failed');
    expect(control.state()).toBeUndefined();
    await control.move('paused');
    expect(ran).toEqual(['stop api', 'pause api']);
    expect(control.state()).toBe('paused');
  });
});

describe('the batch helper', () => {
  const helperFor = async (container, open) => {
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

describe('the list a batch ends with', () => {
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

  it('stops resuming after the cap when every resume crashes on the same check', async () => {
    let resumes = 0;
    await resumeBatch(runs, async (rest) => {
      resumes++;
      return { rest: resumes > 20 ? [] : rest };
    });
    expect(resumes).toBe(MAX_RESUMES);
  });

  it('stops resuming once a resume leaves nothing to run', async () => {
    let resumes = 0;
    await resumeBatch(runs, async () => {
      resumes++;
      return { rest: [] };
    });
    expect(resumes).toBe(1);
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
      expect(readFileSync(join(target, 'batch/reopen.yaml'), 'utf8')).not.toContain('{{t:');
      const reset = readFileSync(join(target, 'batch/reset.yaml'), 'utf8');
      expect(reset).toContain('ASK: /running');
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

  it('stops the worker before the drop and recreates it after migrating', () => {
    expect(verbs(databaseCommands(console_, ['notification-worker'], false))).toEqual([
      'compose stop',
      'console doctrine:database:drop',
      'console doctrine:database:create',
      'console doctrine:migrations:migrate',
      'compose up',
    ]);
  });

  it('keeps the data, and still recreates the worker after migrating', () => {
    expect(verbs(databaseCommands(console_, ['notification-worker'], true))).toEqual([
      'console doctrine:migrations:migrate',
      'compose up',
    ]);
  });

  it('touches no service on a commit with nothing waiting for migrations', () => {
    const commands = databaseCommands(console_, [], false);
    expect(commands.filter(([first]) => first === 'compose')).toEqual([]);
    expect(commands).toHaveLength(3);
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
