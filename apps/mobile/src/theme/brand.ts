/**
 * Google's and Apple's published values, not design tokens: harmonising them
 * with the palette breaks both sets of guidelines. Google's typeface is the
 * `googleSans` family Text takes, because naming a family here bypasses
 * theme/fonts.ts and crashes on web.
 */
export const brand = {
  googleSurface: '#FFFFFF',
  googleBorder: '#747775',
  googleInk: '#1F1F1F',
  googleTextSize: 14,
  googleLineHeight: 20,
  appleSurface: '#000000',
  appleInk: '#FFFFFF',
  /** iOS's own button sets its title in the system font at this share of its height. */
  appleTitleToHeight: 0.43,
  /** Material 3's disabled content, which Google's guidelines defer to; Apple's publish no off look. */
  offOpacity: 0.38,
} as const;
