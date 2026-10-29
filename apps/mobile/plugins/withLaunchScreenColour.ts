import configPlugins, { type ConfigPlugin } from 'expo/config-plugins';

const { withMod } = configPlugins;

const COLOUR_NAME = 'SplashScreenBackground';

type Attributes = Record<string, string>;
type Storyboard = {
  document: {
    scenes: {
      scene: { objects: { viewController: { view: { color?: { $: Attributes }[] }[] }[] }[] }[];
    }[];
    resources?: { namedColor?: unknown[]; systemColor?: unknown[] }[];
  };
};

function channel(hex: string, at: number): string {
  return (parseInt(hex.slice(at, at + 2), 16) / 255).toFixed(15);
}

/** The launch storyboard painted with the named page colour, where expo-splash-screen without an image leaves the template's white. */
export function withPageColourBehind(storyboard: Storyboard, pageColour: string): Storyboard {
  const hex = /^#([0-9a-f]{6})$/i.exec(pageColour)?.[1];
  if (hex == null) {
    throw new Error(`withLaunchScreenColour expects a #RRGGBB colour, not ${pageColour}.`);
  }
  const view = storyboard.document.scenes[0]?.scene[0]?.objects[0]?.viewController[0]?.view[0];
  if (view == null) {
    throw new Error('The launch storyboard has no view to paint.');
  }
  view.color = [{ $: { key: 'backgroundColor', name: COLOUR_NAME } }];

  const resources = (storyboard.document.resources ??= [{}])[0] ?? {};
  delete resources.systemColor;
  resources.namedColor = [
    {
      $: { name: COLOUR_NAME },
      color: [
        {
          $: {
            alpha: '1.000',
            red: channel(hex, 0),
            green: channel(hex, 2),
            blue: channel(hex, 4),
            customColorSpace: 'sRGB',
            colorSpace: 'custom',
          },
        },
      ],
    },
  ];
  storyboard.document.resources[0] = resources;

  return storyboard;
}

/** iOS launches on the page colour rather than white. Applied before the plugins list, so it edits the storyboard after expo-splash-screen has. */
export const withLaunchScreenColour: ConfigPlugin<{ pageColour: string }> = (
  config,
  { pageColour },
) =>
  withMod<Storyboard>(config, {
    platform: 'ios',
    mod: 'splashScreenStoryboard',
    action: (storyboard) => {
      storyboard.modResults = withPageColourBehind(storyboard.modResults, pageColour);

      return storyboard;
    },
  });
