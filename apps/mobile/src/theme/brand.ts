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
  /** Measured off iOS's own 48pt button, not the guidelines' 43%: 18.5pt words, a 13pt logo 6.5pt before them. */
  appleTitleToHeight: 0.385,
  appleLogoToHeight: 13 / 48,
  appleLogoGap: 6.5,
  /** Material 3's disabled content, which Google's guidelines defer to; Apple's publish no off look. */
  offOpacity: 0.38,
} as const;
