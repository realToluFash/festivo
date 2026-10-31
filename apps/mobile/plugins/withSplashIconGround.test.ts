import { describe, expect, it } from 'vitest';

import { withIconGroundInTheme } from './withSplashIconGround.ts';

function splashStyles() {
  return {
    resources: {
      style: [
        { $: { name: 'AppTheme' }, item: [] },
        {
          $: { name: 'Theme.App.SplashScreen' },
          item: [
            { $: { name: 'windowSplashScreenBackground' }, _: '@color/splashscreen_background' },
            { $: { name: 'windowSplashScreenAnimatedIcon' }, _: '@drawable/splashscreen_logo' },
          ],
        },
      ],
    },
  };
}

describe('withIconGroundInTheme', () => {
  it('gives the splash theme an icon background, keeping what expo-splash-screen wrote', () => {
    const theme = withIconGroundInTheme(splashStyles(), '#123456').resources.style?.[1];

    expect(theme?.item).toEqual([
      { $: { name: 'windowSplashScreenBackground' }, _: '@color/splashscreen_background' },
      { $: { name: 'windowSplashScreenAnimatedIcon' }, _: '@drawable/splashscreen_logo' },
      { $: { name: 'windowSplashScreenIconBackgroundColor' }, _: '#123456' },
    ]);
  });

  it('sets it once when run again', () => {
    const twice = withIconGroundInTheme(
      withIconGroundInTheme(splashStyles(), '#000000'),
      '#123456',
    );

    expect(
      twice.resources.style?.[1]?.item.filter(
        ({ $ }) => $.name === 'windowSplashScreenIconBackgroundColor',
      ),
    ).toEqual([{ $: { name: 'windowSplashScreenIconBackgroundColor' }, _: '#123456' }]);
  });

  it('refuses a colour that is not #RRGGBB', () => {
    expect(() => withIconGroundInTheme(splashStyles(), '123456')).toThrow(/#RRGGBB/);
  });

  it('refuses a theme expo-splash-screen did not write', () => {
    expect(() => withIconGroundInTheme({ resources: { style: [] } }, '#123456')).toThrow(
      /Theme\.App\.SplashScreen/,
    );
  });
});
