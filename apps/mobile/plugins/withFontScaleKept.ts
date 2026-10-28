import configPlugins, { type ConfigPlugin } from 'expo/config-plugins.js';

const { AndroidConfig, withAndroidManifest, withMainActivity } = configPlugins;

const IMPORTS = [
  'import android.content.ComponentCallbacks',
  'import android.content.res.Configuration',
  'import android.os.Bundle',
  'import android.view.View',
  'import android.view.ViewGroup',
  'import com.facebook.react.bridge.LifecycleEventListener',
  'import com.facebook.react.uimanager.DisplayMetricsHolder',
  'import com.th3rdwave.safeareacontext.SafeAreaProvider',
];

// React Native measures text against the application's font scale, which Android may update after the activity's: a layout in between keeps the old size under the new scale, and its measurement is cached.
// React Native asks for that layout only when the application's scale has moved, so the activity asks for it when the activity's has.
// The display metrics the holder points at are live, and may already hold the new values before this callback, so what moved is read from the configuration the activity last saw.
// React Native tells JavaScript about a new font scale only on resume, and DeviceInfo reads both scale and density from the application, so the forward waits until the application has the activity's current ones, however many changes it is behind, then lays out again for the root view to send the new dimensions.
// DeviceInfo is internal to React Native, so a debug build fails here on the first upgrade that renames it or drops the interface.
// The safe-area frame, which picks the tablet layout, is sent only when it moves in pixels, and a display-size change keeps the window's pixels, so its last frame is forgotten to send it again at the new density.
const OVERRIDE = `
  private var applicationWait: ComponentCallbacks? = null
  private var lastFontScale = 0f
  private var lastDensityDpi = 0

  override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)
    lastFontScale = resources.configuration.fontScale
    lastDensityDpi = resources.configuration.densityDpi
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    DisplayMetricsHolder.initDisplayMetrics(this)
    if (newConfig.fontScale != lastFontScale) {
      reactDelegate?.reactRootView?.requestLayout()
    }
    if (newConfig.densityDpi != lastDensityDpi) {
      reactDelegate?.reactRootView?.let { resendSafeAreaFrames(it) }
    }
    lastFontScale = newConfig.fontScale
    lastDensityDpi = newConfig.densityDpi
    if (!forwardOnceApplicationCaughtUp() && applicationWait == null) {
      applicationWait = object : ComponentCallbacks {
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
    val applicationConfig = application.resources.configuration
    if (applicationConfig.fontScale != resources.configuration.fontScale ||
      applicationConfig.densityDpi != resources.configuration.densityDpi
    ) {
      return false
    }
    stopWaitingForApplication()
    forwardSizes()
    return true
  }

  private fun stopWaitingForApplication() {
    applicationWait?.let { application.unregisterComponentCallbacks(it) }
    applicationWait = null
  }

  private fun forwardSizes() {
    val context = reactHost?.currentReactContext ?: return
    val deviceInfo = context.getNativeModule("DeviceInfo") as? LifecycleEventListener
    check(deviceInfo != null || !BuildConfig.DEBUG) {
      "DeviceInfo no longer listens for resume; a font-size change will not reach JavaScript."
    }
    deviceInfo?.onHostResume()
    reactDelegate?.reactRootView?.requestLayout()
  }

  private fun resendSafeAreaFrames(view: View) {
    if (view is SafeAreaProvider) {
      val lastFrame = runCatching {
        SafeAreaProvider::class.java.getDeclaredField("mLastFrame").apply { isAccessible = true }
      }.getOrNull()
      check(lastFrame != null || !BuildConfig.DEBUG) {
        "SafeAreaProvider no longer keeps mLastFrame; a display-size change will not move the layout."
      }
      lastFrame?.set(view, null)
      view.invalidate()
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        resendSafeAreaFrames(view.getChildAt(index))
      }
    }
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
  if (/override fun (onConfigurationChanged|onPostCreate|onDestroy)\b/.test(source)) {
    throw new Error(
      'MainActivity already handles configuration changes, its creation or its destruction; merge the font-scale forward into it.',
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
