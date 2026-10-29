import { describe, expect, it } from 'vitest';

import { withFontScaleForwarded, withTextChangesHandled } from './withFontScaleKept.ts';

const ACTIVITY = `package com.soirely.app
import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe('withTextChangesHandled', () => {
  it('adds fontScale, density and fontWeightAdjustment to the changes the template handles', () => {
    expect(withTextChangesHandled('keyboard|orientation|screenSize|smallestScreenSize')).toBe(
      'keyboard|orientation|screenSize|smallestScreenSize|fontScale|density|fontWeightAdjustment',
    );
  });

  it('leaves each once when it is already there', () => {
    expect(withTextChangesHandled('fontScale|locale')).toBe(
      'fontScale|locale|density|fontWeightAdjustment',
    );
    expect(withTextChangesHandled('fontWeightAdjustment|density|fontScale')).toBe(
      'fontWeightAdjustment|density|fontScale',
    );
  });

  it('handles the three alone when the activity names nothing', () => {
    expect(withTextChangesHandled(undefined)).toBe('fontScale|density|fontWeightAdjustment');
  });
});

describe('withFontScaleForwarded', () => {
  const forwarded = withFontScaleForwarded(ACTIVITY);

  it('imports what the override names, under the package line', () => {
    expect(forwarded).toMatch(
      /^package com\.soirely\.app\nimport android\.content\.ComponentCallbacks\nimport android\.content\.Context\nimport android\.content\.res\.Configuration\nimport android\.view\.View\nimport android\.view\.ViewGroup\nimport android\.widget\.FrameLayout\nimport com\.facebook\.react\.bridge\.LifecycleEventListener\nimport com\.facebook\.react\.uimanager\.DisplayMetricsHolder\nimport com\.th3rdwave\.safeareacontext\.SafeAreaProvider\n/,
    );
  });

  it('passes the change on to DeviceInfo inside the class', () => {
    expect(forwarded).toContain('super.onConfigurationChanged(newConfig)');
    expect(forwarded).toContain('getNativeModule("DeviceInfo") as? LifecycleEventListener');
    expect(forwarded).toMatch(
      /deviceInfo\?\.onHostResume\(\)\n\s+reactDelegate\?\.reactRootView\?\.requestLayout\(\)/,
    );
    expect(forwarded.trimEnd().endsWith('  }\n}')).toBe(true);
  });

  it("reads the sizes again on the activity's change", () => {
    expect(forwarded).toMatch(
      /override fun onConfigurationChanged\(newConfig: Configuration\) \{\n\s+super\.onConfigurationChanged\(newConfig\)\n\s+takeSizeChanges\(\)\n/,
    );
  });

  it("reads the sizes again on the application's change, which may reach the activity's resources first", () => {
    expect(forwarded).toMatch(
      /override fun onConfigurationChanged\(applicationConfig: Configuration\) \{\n\s+takeSizeChanges\(\)\n/,
    );
  });

  it('measures text against the activity, before anything is laid out again', () => {
    expect(forwarded).toMatch(
      /private fun takeSizeChanges\(\) \{\n\s+val activityConfig = resources\.configuration\n\s+DisplayMetricsHolder\.initDisplayMetrics\(this\)\n/,
    );
  });

  it("puts the root view in a parent that reads the metrics again before it is measured or laid out, when they no longer match the activity's, and fills them first on a cold start", () => {
    expect(forwarded).toMatch(
      /override fun setContentView\(view: View\?\) \{\n\s+super\.setContentView\(\n\s+view\?\.let \{\n\s+MetricsReadFirst\(this\) \{\n\s+reactHost\?\.currentReactContext\?\.emitDeviceEvent\("soirelyTextScaleLaidOut"\)\n\s+\}\.apply \{\n\s+addView\(it, ViewGroup\.LayoutParams\.MATCH_PARENT, ViewGroup\.LayoutParams\.MATCH_PARENT\)/,
    );
    expect(forwarded).toMatch(
      /override fun onMeasure\(widthMeasureSpec: Int, heightMeasureSpec: Int\) \{\n\s+readMetricsIfMoved\(\)\n/,
    );
    expect(forwarded).toMatch(
      /override fun onLayout\([^)]*\) \{\n\s+readMetricsIfMoved\(\)\n\s+super\.onLayout/,
    );
    expect(forwarded).toMatch(
      /private fun readMetricsIfMoved\(\) \{\n\s+DisplayMetricsHolder\.initDisplayMetricsIfNotInitialized\(context\)\n\s+val activityMetrics = resources\.displayMetrics\n\s+val reactMetrics = DisplayMetricsHolder\.getScreenDisplayMetrics\(\)/,
    );
    expect(forwarded).toMatch(
      /if \(reactMetrics\.scaledDensity != activityMetrics\.scaledDensity \|\|\n\s+reactMetrics\.densityDpi != activityMetrics\.densityDpi\n\s+\) \{\n\s+DisplayMetricsHolder\.initDisplayMetrics\(context\)/,
    );
  });

  it('measures the root view again at a new scale, then tells JavaScript, but not on the first measure', () => {
    expect(forwarded).toMatch(
      /val newScale = fontScale != laidOutFontScale\n\s+if \(newScale\) getChildAt\(0\)\?\.forceLayout\(\)\n\s+super\.onMeasure\(widthMeasureSpec, heightMeasureSpec\)\n\s+if \(newScale\) \{\n\s+if \(!laidOutFontScale\.isNaN\(\)\) laidOutAtNewScale\(\)\n\s+laidOutFontScale = fontScale\n/,
    );
  });

  it('refuses an activity that already sets its content view', () => {
    const contented = ACTIVITY.replace(
      '\n}\n',
      '\n  override fun setContentView(view: View?) {\n    super.setContentView(view)\n  }\n}\n',
    );
    expect(() => withFontScaleForwarded(contented)).toThrow(/already handles/);
  });

  it('remembers the scale and density the activity was created with, then listens to the application', () => {
    expect(forwarded).toMatch(
      /override fun onPostCreate\(savedInstanceState: Bundle\?\) \{\n\s+super\.onPostCreate\(savedInstanceState\)\n\s+lastFontScale = resources\.configuration\.fontScale\n\s+lastDensityDpi = resources\.configuration\.densityDpi\n\s+application\.registerComponentCallbacks\(applicationChanges\)\n/,
    );
  });

  it("lays the root view out again when the activity's scale moved", () => {
    expect(forwarded).toMatch(
      /if \(activityConfig\.fontScale != lastFontScale\) \{\n\s+reactDelegate\?\.reactRootView\?\.requestLayout\(\)\n\s+forwardPending = true/,
    );
  });

  it("sends the safe-area frame again when the activity's density moved, then remembers both", () => {
    expect(forwarded).toMatch(
      /if \(activityConfig\.densityDpi != lastDensityDpi\) \{\n\s+reactDelegate\?\.reactRootView\?\.let \{ resendSafeAreaFrames\(it\) \}\n\s+forwardPending = true\n\s+\}\n\s+lastFontScale = activityConfig\.fontScale\n\s+lastDensityDpi = activityConfig\.densityDpi\n/,
    );
    expect(forwarded).toContain('getDeclaredField("mLastFrame")');
    expect(forwarded).toMatch(/lastFrame\?\.set\(view, null\)\n\s+view\.invalidate\(\)/);
    expect(forwarded).toContain('check(lastFrame != null || !BuildConfig.DEBUG)');
  });

  it("forwards a pending change once the application has the activity's scale and density", () => {
    expect(forwarded).toMatch(
      /if \(forwardPending &&\n\s+applicationConfig\.fontScale == activityConfig\.fontScale &&\n\s+applicationConfig\.densityDpi == activityConfig\.densityDpi\n\s+\) \{\n\s+forwardPending = false\n\s+forwardSizes\(\)/,
    );
  });

  it('stops listening to the application when the activity is destroyed', () => {
    expect(forwarded).toMatch(
      /override fun onDestroy\(\) \{\n\s+application\.unregisterComponentCallbacks\(applicationChanges\)\n\s+super\.onDestroy\(\)/,
    );
  });

  it('fails a debug build loudly when DeviceInfo stops listening for resume', () => {
    expect(forwarded).toContain('check(deviceInfo != null || !BuildConfig.DEBUG)');
  });

  it('refuses an activity that already handles configuration changes, rather than declaring it twice', () => {
    expect(() => withFontScaleForwarded(forwarded)).toThrow(/already handles/);
  });

  it('refuses an activity that already overrides onDestroy', () => {
    const destroying = ACTIVITY.replace(
      '\n}\n',
      '\n  override fun onDestroy() {\n    super.onDestroy()\n  }\n}\n',
    );
    expect(() => withFontScaleForwarded(destroying)).toThrow(/already handles/);
  });

  it('refuses an activity that already overrides onPostCreate', () => {
    const created = ACTIVITY.replace(
      '\n}\n',
      '\n  override fun onPostCreate(savedInstanceState: Bundle?) {\n    super.onPostCreate(savedInstanceState)\n  }\n}\n',
    );
    expect(() => withFontScaleForwarded(created)).toThrow(/already handles/);
  });
});
