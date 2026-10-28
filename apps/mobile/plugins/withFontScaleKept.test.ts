import { describe, expect, it } from 'vitest';

import { withFontScaleForwarded, withSizeChangesHandled } from './withFontScaleKept.ts';

const ACTIVITY = `package com.soirely.app
import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe('withSizeChangesHandled', () => {
  it('adds fontScale and density to the changes the template handles', () => {
    expect(withSizeChangesHandled('keyboard|orientation|screenSize|smallestScreenSize')).toBe(
      'keyboard|orientation|screenSize|smallestScreenSize|fontScale|density',
    );
  });

  it('leaves each once when it is already there', () => {
    expect(withSizeChangesHandled('fontScale|locale')).toBe('fontScale|locale|density');
    expect(withSizeChangesHandled('density|fontScale')).toBe('density|fontScale');
  });

  it('handles the two alone when the activity names nothing', () => {
    expect(withSizeChangesHandled(undefined)).toBe('fontScale|density');
  });
});

describe('withFontScaleForwarded', () => {
  const forwarded = withFontScaleForwarded(ACTIVITY);

  it('imports what the override names, under the package line', () => {
    expect(forwarded).toMatch(
      /^package com\.soirely\.app\nimport android\.content\.ComponentCallbacks\nimport android\.content\.res\.Configuration\nimport com\.facebook\.react\.bridge\.LifecycleEventListener\nimport com\.facebook\.react\.uimanager\.DisplayMetricsHolder\nimport com\.facebook\.react\.uimanager\.PixelUtil\n/,
    );
  });

  it('passes the change on to DeviceInfo inside the class', () => {
    expect(forwarded).toContain('super.onConfigurationChanged(newConfig)');
    expect(forwarded).toContain('getNativeModule("DeviceInfo") as? LifecycleEventListener');
    expect(forwarded).toContain('deviceInfo?.onHostResume()');
    expect(forwarded.trimEnd().endsWith('  }\n}')).toBe(true);
  });

  it('measures text against the activity, whose font scale is already the new one', () => {
    expect(forwarded).toMatch(
      /super\.onConfigurationChanged\(newConfig\)\n\s+val measuredScale = PixelUtil\.toPixelFromSP\(1\.0\)\n\s+DisplayMetricsHolder\.initDisplayMetrics\(this\)\n/,
    );
  });

  it('lays the root view out again when the measured scale moved', () => {
    expect(forwarded).toMatch(
      /if \(PixelUtil\.toPixelFromSP\(1\.0\) != measuredScale\) \{\n\s+reactDelegate\?\.reactRootView\?\.requestLayout\(\)/,
    );
  });

  it("forwards once the application has the activity's current scale, and stops listening only then", () => {
    expect(forwarded).toContain(
      'if (application.resources.configuration.fontScale != resources.configuration.fontScale) {',
    );
    expect(forwarded).toContain(
      'if (!forwardOnceApplicationCaughtUp() && fontScaleWait == null) {',
    );
    expect(forwarded).toMatch(
      /override fun onConfigurationChanged\(applicationConfig: Configuration\) \{\n\s+forwardOnceApplicationCaughtUp\(\)\n\s+\}/,
    );
    expect(forwarded).toMatch(
      /return false\n\s+\}\n\s+stopWaitingForApplication\(\)\n\s+forwardFontScale\(\)/,
    );
  });

  it('stops listening when the activity is destroyed', () => {
    expect(forwarded).toMatch(
      /override fun onDestroy\(\) \{\n\s+stopWaitingForApplication\(\)\n\s+super\.onDestroy\(\)/,
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
});
