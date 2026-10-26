import configPlugins, { type ConfigPlugin } from 'expo/config-plugins.js';

const { AndroidConfig, withAndroidManifest, withMainActivity } = configPlugins;

const IMPORTS = [
  'import android.content.res.Configuration',
  'import com.facebook.react.bridge.LifecycleEventListener',
];

// React Native tells JavaScript about a new font scale only on resume, so a change made while the app stays open would never reach it.
const OVERRIDE = `
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    (reactHost?.currentReactContext?.getNativeModule("DeviceInfo") as? LifecycleEventListener)?.onHostResume()
  }
`;

/** Android keeps the open screen through a font-size change, as iOS does, rather than starting the app over. */
export const withFontScaleKept: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (manifest) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest.modResults);
    const changes = (activity.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    if (!changes.includes('fontScale')) changes.push('fontScale');
    activity.$['android:configChanges'] = changes.join('|');

    return manifest;
  });

  return withMainActivity(config, (activity) => {
    if (activity.modResults.language !== 'kt') {
      throw new Error('withFontScaleKept expects a Kotlin MainActivity.');
    }
    let source = activity.modResults.contents;
    if (source.includes('override fun onConfigurationChanged')) return activity;

    const missing = IMPORTS.filter((line) => !source.includes(line));
    source = source.replace(/^package .+$/m, (line) => [line, ...missing].join('\n'));
    source = source.replace(/\n}\s*$/, `\n${OVERRIDE}}\n`);
    activity.modResults.contents = source;

    return activity;
  });
};
