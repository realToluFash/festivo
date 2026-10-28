import configPlugins, { type ConfigPlugin } from 'expo/config-plugins.js';

const { AndroidConfig, withAndroidManifest, withMainActivity } = configPlugins;

const IMPORTS = [
  'import android.content.ComponentCallbacks',
  'import android.content.res.Configuration',
  'import com.facebook.react.bridge.LifecycleEventListener',
  'import com.facebook.react.uimanager.DisplayMetricsHolder',
  'import com.facebook.react.uimanager.PixelUtil',
];

// React Native measures text against the application's font scale, which Android may update after the activity's: a layout in between keeps the old size under the new scale, and its measurement is cached.
// React Native asks for that layout only when the application's scale has moved, so the activity asks for it when the activity's has.
// React Native tells JavaScript about a new font scale only on resume, and reads it from the application, so the forward waits until the application has the activity's current scale, however many changes it is behind.
// DeviceInfo is internal to React Native, so a debug build fails here on the first upgrade that renames it or drops the interface.
const OVERRIDE = `
  private var fontScaleWait: ComponentCallbacks? = null

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val measuredScale = PixelUtil.toPixelFromSP(1.0)
    DisplayMetricsHolder.initDisplayMetrics(this)
    if (PixelUtil.toPixelFromSP(1.0) != measuredScale) {
      reactDelegate?.reactRootView?.requestLayout()
    }
    if (!forwardOnceApplicationCaughtUp() && fontScaleWait == null) {
      fontScaleWait = object : ComponentCallbacks {
        override fun onConfigurationChanged(applicationConfig: Configuration) {
          forwardOnceApplicationCaughtUp()
        }

        override fun onLowMemory() = Unit
      }.also { application.registerComponentCallbacks(it) }
    }
  }

  override fun onDestroy() {
    stopWaitingForApplication()
    super.onDestroy()
  }

  private fun forwardOnceApplicationCaughtUp(): Boolean {
    if (application.resources.configuration.fontScale != resources.configuration.fontScale) {
      return false
    }
    stopWaitingForApplication()
    forwardFontScale()
    return true
  }

  private fun stopWaitingForApplication() {
    fontScaleWait?.let { application.unregisterComponentCallbacks(it) }
    fontScaleWait = null
  }

  private fun forwardFontScale() {
    val context = reactHost?.currentReactContext ?: return
    val deviceInfo = context.getNativeModule("DeviceInfo") as? LifecycleEventListener
    check(deviceInfo != null || !BuildConfig.DEBUG) {
      "DeviceInfo no longer listens for resume; a font-size change will not reach JavaScript."
    }
    deviceInfo?.onHostResume()
  }
`;

const SIZE_CHANGES = ['fontScale', 'density'];

/** The activity's configChanges with font size and display size among them, so Android hands either change to the app instead of recreating it. */
export function withSizeChangesHandled(configChanges: string | undefined): string {
  const changes = (configChanges ?? '').split('|').filter(Boolean);

  return [...changes, ...SIZE_CHANGES.filter((change) => !changes.includes(change))].join('|');
}

/** MainActivity.kt, passing a configuration change on to JavaScript at once. */
export function withFontScaleForwarded(source: string): string {
  if (/override fun (onConfigurationChanged|onDestroy)\b/.test(source)) {
    throw new Error(
      'MainActivity already handles configuration changes or its destruction; merge the font-scale forward into it.',
    );
  }
  const missing = IMPORTS.filter((line) => !source.includes(line));

  return source
    .replace(/^package .+$/m, (line) => [line, ...missing].join('\n'))
    .replace(/\n}\s*$/, `\n${OVERRIDE}}\n`);
}

/** Android keeps the open screen through a font-size or display-size change, as iOS does through a font-size change, rather than starting the app over. */
export const withFontScaleKept: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (manifest) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest.modResults);
    activity.$['android:configChanges'] = withSizeChangesHandled(
      activity.$['android:configChanges'],
    );

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
