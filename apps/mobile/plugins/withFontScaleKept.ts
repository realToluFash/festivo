import configPlugins, { type ConfigPlugin } from 'expo/config-plugins.js';

const { AndroidConfig, withAndroidManifest, withMainActivity } = configPlugins;

const IMPORTS = [
  'import android.content.res.Configuration',
  'import com.facebook.react.bridge.LifecycleEventListener',
];

// React Native tells JavaScript about a new font scale only on resume, so a change made while the app stays open would never reach it.
// DeviceInfo is internal to React Native, so a debug build fails here on the first upgrade that renames it or drops the interface.
const OVERRIDE = `
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val context = reactHost?.currentReactContext ?: return
    val deviceInfo = context.getNativeModule("DeviceInfo") as? LifecycleEventListener
    check(deviceInfo != null || !BuildConfig.DEBUG) {
      "DeviceInfo no longer listens for resume; a font-size change will not reach JavaScript."
    }
    deviceInfo?.onHostResume()
  }
`;

/** The activity's configChanges with fontScale among them, so Android hands the change to the app instead of recreating it. */
export function withFontScaleHandled(configChanges: string | undefined): string {
  const changes = (configChanges ?? '').split('|').filter(Boolean);

  return (changes.includes('fontScale') ? changes : [...changes, 'fontScale']).join('|');
}

/** MainActivity.kt, passing a configuration change on to JavaScript at once. */
export function withFontScaleForwarded(source: string): string {
  if (source.includes('override fun onConfigurationChanged')) {
    throw new Error(
      'MainActivity already handles configuration changes; merge the font-scale forward into it.',
    );
  }
  const missing = IMPORTS.filter((line) => !source.includes(line));

  return source
    .replace(/^package .+$/m, (line) => [line, ...missing].join('\n'))
    .replace(/\n}\s*$/, `\n${OVERRIDE}}\n`);
}

/** Android keeps the open screen through a font-size change, as iOS does, rather than starting the app over. */
export const withFontScaleKept: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (manifest) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest.modResults);
    activity.$['android:configChanges'] = withFontScaleHandled(activity.$['android:configChanges']);

    return manifest;
  });

  return withMainActivity(config, (activity) => {
    if (activity.modResults.language !== 'kt') {
      throw new Error('withFontScaleKept expects a Kotlin MainActivity.');
    }
    activity.modResults.contents = withFontScaleForwarded(activity.modResults.contents);

    return activity;
  });
};
