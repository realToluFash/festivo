/*
 * CSS linting, for the web client.
 *
 * The one rule that is ours rather than the standard config's: no colour
 * literals outside the generated token file. docs/design/tokens.mjs is the
 * source, scripts/build-tokens.mjs generates apps/web/src/tokens.css from it,
 * and a hex written anywhere else is a second opinion about the same colour
 * that no longer tracks the design.
 */
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    'services/api/public/bundles/**',
  ],
  rules: {
    // Generated from the design tokens, so a value here is a value the design
    // chose. Everywhere else reads it with var().
    'color-no-hex': true,
    'color-named': 'never',
    'color-function-notation': 'modern',

    // camelCase, because that is what scripts/build-tokens.mjs emits from
    // docs/design/tokens.mjs — all 201 of them. A hand-written --my-colour in
    // kebab-case would read as a different kind of thing than the tokens it
    // sits beside, which is how a second vocabulary starts.
    'custom-property-pattern': '^[a-z][a-zA-Z0-9]*$',
  },
  overrides: [
    {
      // Google's and Apple's published button values. They are requirements
      // from outside this product rather than choices inside it, so they are
      // not tokens and they are not negotiable — see the file's own header.
      // Written literally in one place that says whose they are, instead of
      // being tokenised where somebody would later harmonise them with the
      // palette and break both guidelines.
      files: ['apps/web/src/brand.css'],
      rules: {
        'color-no-hex': null,
        'color-hex-length': null,
      },
    },
    {
      // The generated file. It is where the colours live, and it is the only
      // place they may be written literally.
      files: ['apps/web/src/tokens.css'],
      // Formatting is the generator's business, not this file's: these are
      // the literal values from docs/design/tokens.mjs, and shortening #FFFFFF
      // to #FFF or rewriting rgba() would make the generated file disagree with
      // its own source. The generator has its own tests, including a drift
      // guard.
      rules: {
        'color-no-hex': null,
        'color-hex-length': null,
        'color-function-notation': null,
        'color-function-alias-notation': null,
        'alpha-value-notation': null,
      },
    },
  ],
};
