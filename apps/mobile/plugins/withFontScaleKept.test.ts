import { describe, expect, it } from 'vitest';

import { withFontScaleForwarded, withFontScaleHandled } from './withFontScaleKept.ts';

const ACTIVITY = `package com.soirely.app
import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe('withFontScaleHandled', () => {
  it('adds fontScale to the changes the template handles', () => {
    expect(withFontScaleHandled('keyboard|orientation|screenSize')).toBe(
      'keyboard|orientation|screenSize|fontScale',
    );
  });

  it('leaves fontScale once when it is already there', () => {
    expect(withFontScaleHandled('fontScale|locale')).toBe('fontScale|locale');
  });

  it('handles fontScale alone when the activity names nothing', () => {
    expect(withFontScaleHandled(undefined)).toBe('fontScale');
  });
});

describe('withFontScaleForwarded', () => {
  const forwarded = withFontScaleForwarded(ACTIVITY);

  it('imports what the override names, under the package line', () => {
    expect(forwarded).toMatch(
      /^package com\.soirely\.app\nimport android\.content\.res\.Configuration\nimport com\.facebook\.react\.bridge\.LifecycleEventListener\n/,
    );
  });

  it('passes the change on to DeviceInfo inside the class', () => {
    expect(forwarded).toContain('super.onConfigurationChanged(newConfig)');
    expect(forwarded).toContain('getNativeModule("DeviceInfo") as? LifecycleEventListener');
    expect(forwarded).toContain('deviceInfo?.onHostResume()');
    expect(forwarded.trimEnd().endsWith('  }\n}')).toBe(true);
  });

  it('fails a debug build loudly when DeviceInfo stops listening for resume', () => {
    expect(forwarded).toContain('check(deviceInfo != null || !BuildConfig.DEBUG)');
  });

  it('refuses an activity that already handles configuration changes, rather than declaring it twice', () => {
    expect(() => withFontScaleForwarded(forwarded)).toThrow(/already handles/);
  });
});
