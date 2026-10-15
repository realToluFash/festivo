/**
 * Somebody else's brand, and therefore not a token.
 *
 * Google and Apple publish the exact colour and wording their sign-in buttons
 * must use, and neither is a decision this product gets to make. Filing them
 * among the design tokens would invite somebody to harmonise them with the
 * palette later, which both sets of guidelines forbid.
 *
 * The web client has the same values in `apps/web/src/brand.css`, with the
 * same reasoning. Change one only because its owner changed it.
 *
 * One thing is NOT honoured here: both specify a typeface — Roboto for Google,
 * the platform face for Apple — and this app resolves type by weight through
 * `theme/fonts.ts`, where naming a family bypasses the mapper and crashes on
 * web. So the buttons use the app's face at the weight their owners ask for.
 */
export const brand = {
  googleSurface: '#FFFFFF',
  googleBorder: '#747775',
  googleInk: '#1F1F1F',
  appleSurface: '#000000',
  appleInk: '#FFFFFF',
} as const;
