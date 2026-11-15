import configPlugins, { type ConfigPlugin } from 'expo/config-plugins';

type Manifest = configPlugins.AndroidConfig.Manifest.AndroidManifest;

const { withAndroidManifest } = configPlugins;

const SCHEME = 'otpauth';

/** The manifest asking Android 11 and later to show the app which apps open otpauth:// links, once. */
export function withAuthenticatorQuery(manifest: Manifest): Manifest {
  const queries = manifest.manifest.queries ?? [];
  const asked = queries.some((query) =>
    query.intent?.some((intent) =>
      intent.data?.some((data) => data.$['android:scheme'] === SCHEME),
    ),
  );
  if (asked) return manifest;

  return {
    ...manifest,
    manifest: {
      ...manifest.manifest,
      queries: [
        ...queries,
        {
          intent: [
            {
              action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
              data: [{ $: { 'android:scheme': SCHEME } }],
            },
          ],
        },
      ],
    },
  };
}

/** Add to my authenticator app shows only where an app takes the link, which Android answers only for a scheme the manifest queries (sc-40025). */
export const withAuthenticatorQueried: ConfigPlugin = (config) =>
  withAndroidManifest(config, (manifest) => {
    manifest.modResults = withAuthenticatorQuery(manifest.modResults);

    return manifest;
  });
