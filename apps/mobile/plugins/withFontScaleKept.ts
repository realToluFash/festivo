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

// React Native measures text against the display metrics it last read, and caches each measurement under the font scale the activity's resources had when the root view was measured.
// Android may give the activity's resources a new scale with the application's change, before the activity's own callback: a layout in between caches the old size under the new scale, and asking for a layout again finds nothing changed and keeps it.
// So the metrics are read again from the activity on either change, before the next layout, and the root view is laid out when the scale the activity last saw has moved.
// React Native tells JavaScript about a new font scale only on resume, and DeviceInfo reads both scale and density from the application, so the forward waits until the application has the activity's current ones, however many changes it is behind, then lays out again for the root view to send the new dimensions.
// DeviceInfo is internal to React Native, so a debug build fails here on the first upgrade that renames it or drops the interface.
// The safe-area frame, which picks the tablet layout, is sent only when it moves in pixels, and a display-size change keeps the window's pixels, so its last frame is forgotten to send it again at the new density.
const OVERRIDE = `
  private val applicationChanges = object : ComponentCallbacks {
    override fun onConfigurationChanged(applicationConfig: Configuration) {
      takeSizeChanges()
    }

    override fun onLowMemory() = Unit
  }
  private var lastFontScale = 0f
  private var lastDensityDpi = 0
  private var forwardPending = false

  override fun onPostCreate(savedInstanceState: Bundle?) {
    super.onPostCreate(savedInstanceState)
    lastFontScale = resources.configuration.fontScale
    lastDensityDpi = resources.configuration.densityDpi
    application.registerComponentCallbacks(applicationChanges)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    takeSizeChanges()
  }

  override fun onDestroy() {
    application.unregisterComponentCallbacks(applicationChanges)
    super.onDestroy()
  }

  private fun takeSizeChanges() {
    val activityConfig = resources.configuration
    DisplayMetricsHolder.initDisplayMetrics(this)
    if (activityConfig.fontScale != lastFontScale) {
      reactDelegate?.reactRootView?.requestLayout()
      forwardPending = true
    }
    if (activityConfig.densityDpi != lastDensityDpi) {
      reactDelegate?.reactRootView?.let { resendSafeAreaFrames(it) }
      forwardPending = true
    }
    lastFontScale = activityConfig.fontScale
    lastDensityDpi = activityConfig.densityDpi
    val applicationConfig = application.resources.configuration
    if (forwardPending &&
      applicationConfig.fontScale == activityConfig.fontScale &&
      applicationConfig.densityDpi == activityConfig.densityDpi
    ) {
      forwardPending = false
      forwardSizes()
    }
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
