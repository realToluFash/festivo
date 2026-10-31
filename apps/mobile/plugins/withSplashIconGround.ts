import configPlugins, { type ConfigPlugin } from 'expo/config-plugins';

const { withAndroidStyles } = configPlugins;

const SPLASH_THEME = 'Theme.App.SplashScreen';
const ICON_BACKGROUND = 'windowSplashScreenIconBackgroundColor';
// Only this parent hands the colour on to android:windowSplashScreenIconBackgroundColor; under Theme.SplashScreen it is ignored.
const ICON_BACKGROUND_PARENT = 'Theme.SplashScreen.IconBackground';

type Item = { $: { name: string }; _: string };
type Styles = { resources: { style?: { $: { name: string; parent?: string }; item: Item[] }[] } };

/** The splash theme with an icon background, so Android shows the icon at 240 dp in a 160 dp circle rather than 288 in 192. */
export function withIconGroundInTheme(styles: Styles, ground: string): Styles {
  if (!/^#[0-9a-f]{6}$/i.test(ground)) {
    throw new Error(`withSplashIconGround expects a #RRGGBB colour, not ${ground}.`);
  }
  const theme = styles.resources.style?.find(({ $ }) => $.name === SPLASH_THEME);
  if (theme == null) {
    throw new Error(`There is no ${SPLASH_THEME} to give an icon background.`);
  }
  theme.$ = { ...theme.$, parent: ICON_BACKGROUND_PARENT };
  theme.item = [
    ...theme.item.filter(({ $ }) => $.name !== ICON_BACKGROUND),
    { $: { name: ICON_BACKGROUND }, _: ground },
  ];

  return styles;
}

/** Android's splash icon on its own ground. Applied before the plugins list, so it edits the theme after expo-splash-screen has written it. */
export const withSplashIconGround: ConfigPlugin<{ ground: string }> = (config, { ground }) =>
  withAndroidStyles(config, (styles) => {
    styles.modResults = withIconGroundInTheme(styles.modResults as Styles, ground) as never;

    return styles;
  });
