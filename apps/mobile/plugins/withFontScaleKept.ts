import configPlugins, { type ConfigPlugin } from 'expo/config-plugins.js';

const { AndroidConfig, withAndroidManifest, withMainActivity } = configPlugins;

const IMPORTS = [
  'import android.content.ComponentCallbacks',
  'import android.content.Context',
  'import android.content.res.Configuration',
  'import android.os.Bundle',
  'import android.view.View',
  'import android.view.ViewGroup',
  'import android.widget.FrameLayout',
  'import com.facebook.react.bridge.LifecycleEventListener',
  'import com.facebook.react.uimanager.DisplayMetricsHolder',
  'import com.th3rdwave.safeareacontext.SafeAreaProvider',
];

// React Native measures text against the display metrics it last read, and caches each measurement under the font scale the activity's resources had when the root view was measured.
// Android may give the activity's resources a new scale with the application's change, before the activity's own callback: a layout in between caches the old size under the new scale, and asking for a layout again finds nothing changed and keeps it.
// So the metrics are read again from the activity on either change, and the root view is laid out when the scale the activity last saw has moved.
// Android can also apply a new scale to the activity's resources and lay the window out before either callback, so the root view sits in a parent that reads the metrics again first whenever they no longer match the activity's.
// JavaScript's next commit puts back the texts it last laid out, so one made before the root view's layout at the new scale keeps the old size. The root view is measured whenever the scale moved, and once that layout is in, JavaScript is told to make its texts again.
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

  private class MetricsReadFirst(
    context: Context,
    private val laidOutAtNewScale: () -> Unit,
  ) : FrameLayout(context) {
    private var laidOutFontScale = Float.NaN

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      readMetricsIfMoved()
      val fontScale = resources.configuration.fontScale
      val newScale = fontScale != laidOutFontScale
      if (newScale) getChildAt(0)?.forceLayout()
      super.onMeasure(widthMeasureSpec, heightMeasureSpec)
      if (newScale) {
        if (!laidOutFontScale.isNaN()) laidOutAtNewScale()
        laidOutFontScale = fontScale
      }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
      readMetricsIfMoved()
      super.onLayout(changed, left, top, right, bottom)
    }

    @Suppress("DEPRECATION")
    private fun readMetricsIfMoved() {
      DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(context)
      val activityMetrics = resources.displayMetrics
      val reactMetrics = DisplayMetricsHolder.getScreenDisplayMetrics()
      if (reactMetrics.scaledDensity != activityMetrics.scaledDensity ||
        reactMetrics.densityDpi != activityMetrics.densityDpi
      ) {
        DisplayMetricsHolder.initDisplayMetrics(context)
      }
    }
  }

  override fun setContentView(view: View?) {
    super.setContentView(
      view?.let {
        MetricsReadFirst(this) {
          reactHost?.currentReactContext?.emitDeviceEvent("soirelyTextScaleLaidOut")
        }.apply {
          addView(it, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
      },
    )
  }

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

// Android's own text views draw bold text again on the change, and React Native's text ignores the setting, so a weight change needs nothing laid out.
const TEXT_CHANGES = ['fontScale', 'density', 'fontWeightAdjustment'];

/** The activity's configChanges with font size, display size and bold text among them, so Android hands each change to the app instead of recreating it. */
export function withTextChangesHandled(configChanges: string | undefined): string {
  const changes = (configChanges ?? '').split('|').filter(Boolean);

  return [...changes, ...TEXT_CHANGES.filter((change) => !changes.includes(change))].join('|');
}

/** MainActivity.kt, passing a configuration change on to JavaScript at once. */
export function withFontScaleForwarded(source: string): string {
  if (
    /override fun (onConfigurationChanged|onPostCreate|onDestroy|setContentView)\b/.test(source)
  ) {
    throw new Error(
      'MainActivity already handles configuration changes, its content view, its creation or its destruction; merge the font-scale forward into it.',
    );
  }
  const missing = IMPORTS.filter((line) => !source.includes(line));

  return source
    .replace(/^package .+$/m, (line) => [line, ...missing].join('\n'))
    .replace(/\n}\s*$/, `\n${OVERRIDE}}\n`);
}

/** Android keeps the open screen through a font-size, display-size or bold-text change, as iOS does through a font-size change, rather than starting the app over. */
export const withFontScaleKept: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (manifest) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest.modResults);
    activity.$['android:configChanges'] = withTextChangesHandled(
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
