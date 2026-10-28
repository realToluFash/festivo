import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { withPageColourBehind } from './withLaunchScreenColour.ts';

function templateStoryboard() {
  return {
    document: {
      scenes: [
        {
          scene: [
            {
              objects: [
                {
                  viewController: [
                    {
                      view: [
                        {
                          color: [
                            { $: { key: 'backgroundColor', systemColor: 'systemBackgroundColor' } },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      resources: [{ systemColor: [{ $: { name: 'systemBackgroundColor' } }] }],
    },
  };
}

describe('withPageColourBehind', () => {
  const storyboard = withPageColourBehind(templateStoryboard(), '#F5F6F8');
  const view = storyboard.document.scenes[0]?.scene[0]?.objects[0]?.viewController[0]?.view[0];

  it("paints the view with the named colour, not the system's white", () => {
    expect(view?.color).toEqual([
      { $: { key: 'backgroundColor', name: 'SplashScreenBackground' } },
    ]);
  });

  it('declares the named colour as the page colour, and drops the system colour', () => {
    expect(storyboard.document.resources?.[0]).toEqual({
      namedColor: [
        {
          $: { name: 'SplashScreenBackground' },
          color: [
            {
              $: {
                alpha: '1.000',
                red: '0.960784313725490',
                green: '0.964705882352941',
                blue: '0.972549019607843',
                customColorSpace: 'sRGB',
                colorSpace: 'custom',
              },
            },
          ],
        },
      ],
    });
  });

  it('refuses a colour that is not #RRGGBB', () => {
    expect(() => withPageColourBehind(templateStoryboard(), 'F5F6F8')).toThrow(/#RRGGBB/);
  });
});

describe('withLaunchScreenColour', () => {
  it('edits the storyboard under the mod name expo-splash-screen provides', () => {
    const splashScreen = dirname(
      createRequire(import.meta.url).resolve('expo-splash-screen/package.json'),
    );
    const provider = readFileSync(
      join(splashScreen, 'plugin/build/withIosSplashScreenStoryboard.js'),
      'utf8',
    );

    expect(provider).toContain("'splashScreenStoryboard'");
  });
});
