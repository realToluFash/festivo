/**
 * Google's and Apple's published values, not design tokens: harmonising them
 * with the palette breaks both sets of guidelines. Neither typeface is set,
 * because naming a family bypasses theme/fonts.ts and crashes on web.
 */
export const brand = {
  googleSurface: '#FFFFFF',
  googleBorder: '#747775',
  googleInk: '#1F1F1F',
  appleSurface: '#000000',
  appleInk: '#FFFFFF',
} as const;
