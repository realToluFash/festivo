import type { ExpoConfig } from 'expo/config';

import { withFontScaleKept } from './plugins/withFontScaleKept.ts';
import { withSplashIconGround } from './plugins/withSplashIconGround.ts';
import { tokens } from './src/theme/tokens.ts';

/**
 * Expo configuration, as code so it can read the environment.
 *
 * The API URL is bundled here rather than fetched at boot, which is the
 * OPPOSITE of apps/web — and deliberately so. A web deployment serves one built
 * image to every environment, so baking its URL in is the bug that cost an
 * afternoon. A mobile bundle is the artefact: it is built per environment and
 * shipped through a store or an update channel, so there is no later moment at
 * which a file beside it could be rewritten.
 *
 * What is NOT acceptable in either is a literal in a source file. See the
 * README for pointing a device on the same network at a development machine.
 */
// Apple's answer on Android comes back by this https link, which Android opens in the app only once
// assetlinks.json on the same host has verified it (autoVerify). Absent in development.
const appleAppLink = process.env.EXPO_PUBLIC_APPLE_APP_LINK?.startsWith('https://')
  ? new URL(process.env.EXPO_PUBLIC_APPLE_APP_LINK)
  : null;

const config: ExpoConfig = {
  name: 'Soirely',
  slug: 'soirely',
  version: '0.0.0',
  scheme: 'soirely',
  orientation: 'default',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: tokens.colorPage,
  // No newArchEnabled either, and for the same reason as the edge-to-edge flag
  // below: the New Architecture is the only architecture in this SDK, so the
  // toggle no longer exists. Both keys typecheck as errors rather than being
  // ignored, which is the good outcome — a silently-accepted dead flag reads
  // as a decision somebody made.
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.soirely.app',
    // The native Sign in with Apple sheet, which App Store review asks for beside Google.
    usesAppleSignIn: true,
    // Event day pushes are time-sensitive, so they break through Focus (sc-13214).
    entitlements: { 'com.apple.developer.usernotifications.time-sensitive': true },
  },
  android: {
    package: 'com.soirely.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-mono.png',
      backgroundColor: tokens.colorBrandInk,
    },
    ...(appleAppLink == null
      ? {}
      : {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [
                { scheme: 'https', host: appleAppLink.host, pathPrefix: appleAppLink.pathname },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }),
    // There is deliberately NO edge-to-edge flag here. This SDK has none — the
    // toggle was removed because Android now enforces edge to edge, so the
    // layout always owns the area behind the system bars.
    //
    // Which makes the safe-area wrapper load-bearing rather than polite:
    // src/components/Screen.tsx is the only thing keeping content out of the
    // status bar and off the home indicator, and a screen built on a bare View
    // will look correct on the simulator it was written on and put a button
    // under the gesture bar on the next device.
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-system-ui',
    'expo-notifications',
    // The system's photo picker needs no library access, so nothing asks for it or for the camera.
    [
      'expo-image-picker',
      { photosPermission: false, cameraPermission: false, microphonePermission: false },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: tokens.colorPage,
        // The owner put the symbol on iOS's launch screen too, departing from the HIG on purpose (sc-23302).
        // expo-splash-screen centres the image on a 288 dp canvas, which Android fits to the 240 dp icon in its 160 dp circle.
        android: { image: './assets/splash-icon.png', imageWidth: 288 },
        ios: { image: './assets/launch-tile.png', imageWidth: 120 },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Read at build time from the environment, never written as a literal.
    // Absent is a legitimate state in development — src/config.ts explains
    // what it falls back to and why that is safe only on a simulator.
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    mercureUrl: process.env.EXPO_PUBLIC_MERCURE_URL,
    // Google's endpoints and the app's client id; absent, src/config.ts uses the local sandbox.
    googleAuthorizeUrl: process.env.EXPO_PUBLIC_GOOGLE_AUTHORIZE_URL,
    googleTokenUrl: process.env.EXPO_PUBLIC_GOOGLE_TOKEN_URL,
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    appleAuthorizeUrl: process.env.EXPO_PUBLIC_APPLE_AUTHORIZE_URL,
    appleTokenUrl: process.env.EXPO_PUBLIC_APPLE_TOKEN_URL,
    // The Expo push token is issued per EAS project (sc-19684); absent, the app registers no push.
    eas: { projectId: process.env.EAS_PROJECT_ID },
    appleClientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID,
    appleServicesId: process.env.EXPO_PUBLIC_APPLE_SERVICES_ID,
    appleAppLink: process.env.EXPO_PUBLIC_APPLE_APP_LINK,
    appStoreId: process.env.EXPO_PUBLIC_APP_STORE_ID,
  },
};

export default withSplashIconGround(withFontScaleKept(config), { ground: tokens.colorBrandInk });
