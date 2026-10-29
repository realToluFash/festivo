import js from '@eslint/js';
import expo from 'eslint-config-expo/flat.js';
import a11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'vendor/**',
      '**/vendor/**',
      // Both spellings: a bare 'dist/**' matches only the repository root, so a
      // built app under apps/*/dist was being linted — 10,000 errors from a
      // minified bundle, which reads as a broken lint setup rather than as a
      // missing ignore.
      'dist/**',
      '**/dist/**',
      'build/**',
      '**/build/**',
      '**/ios/**',
      '**/android/**',
      '.agents/**',
      'services/api/var/**',
      // Vendored by Symfony's `assets:install`, which runs on every composer
      // install. Git already ignores them; eslint does not read .gitignore, so
      // it was linting API Platform's minified Swagger bundle and reporting
      // nine thousand errors in code nobody here wrote.
      '**/public/bundles/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // A cast at a boundary is where a wrong assumption hides. See the
      // cross-stack-change skill; the previous build lost three attempts at one
      // bug to a cast between a stored value and the type that read it.
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '**/scripts/**/*.mjs', '**/*.config.{js,mjs,ts}'],
    rules: { 'no-console': 'off' },
  },

  // ── React, both clients ─────────────────────────────────────────────────────
  //
  // react-hooks is the one with no substitute. A hook called inside a branch,
  // or an effect whose dependency list is missing the value it closes over,
  // is correct TypeScript and correct-looking code that misbehaves at runtime
  // in a way no type can describe. Nothing in this repository could see it
  // before.
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/mobile/{src,app}/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,

      // The automatic JSX runtime is on in both apps, so React is not a
      // required import and is not in scope.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // TypeScript already describes a component's props. propTypes would be a
      // second, weaker declaration of the same thing.
      'react/prop-types': 'off',

      // A list rendered without a key is reconciled by position, so editing one
      // row rewrites the wrong one. It is the most common React defect that
      // looks fine until the data changes order.
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],

      // A component defined inside another is a new type on every render, so
      // React unmounts and remounts its whole subtree — losing focus, scroll
      // position and any state inside it.
      'react/no-unstable-nested-components': 'error',
    },
  },

  // ── The web client ──────────────────────────────────────────────────────────
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh, 'jsx-a11y': a11y },
    rules: {
      ...a11y.flatConfigs.recommended.rules,

      // A module exporting both a component and something else cannot be hot
      // replaced, so Vite falls back to a full reload and loses the state you
      // were looking at.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // style-src has no 'unsafe-inline', and it governs style attributes too:
      // a style prop renders nothing in a deployed build and works in vite dev.
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
    },
  },

  // ── The mobile client ───────────────────────────────────────────────────────
  //
  // Expo's own config: React Native globals, the platform-extension import
  // resolution that makes a .native.ts override resolvable, and the rules that
  // only make sense in a React Native tree.
  ...expo.map((config) => ({
    ...config,
    files: ['apps/mobile/{src,app}/**/*.{ts,tsx}'],
  })),
  {
    files: ['apps/mobile/{src,app}/**/*.{ts,tsx}'],
    rules: {
      // Metro warns about every require cycle at launch, and on Android a
      // cycle can hand a module an undefined import.
      'import/no-cycle': 'error',
      // src/theme/fonts.ts states two rules. textGuard.test.ts enforces the
      // second — no Text inside a Text, no onPress on a Text — and nothing
      // enforced the first until now.
      //
      // A custom face ships as one file per weight, so a mapper resolves
      // fontWeight to the right file. Writing fontFamily bypasses the mapper,
      // and on React Native Web the previous build crashed when it happened.
      // Ask for a weight: `weight('semibold')` from src/theme/fonts.ts.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='fontFamily']",
          message:
            'Never set fontFamily — it bypasses the weight mapper and crashes on web. Use weight() from src/theme/fonts.ts.',
        },
        {
          selector:
            "ImportDeclaration[source.value='react-native'] ImportSpecifier[imported.name='Text']",
          message:
            "Import Text from src/components/Text.tsx. React Native's own Text accepts onPress, which crashes on web.",
        },
      ],
    },
  },
  {
    // The mapper, the file that documents the rule, and the tests that hold
    // them all have to name the thing they are about.
    files: [
      'apps/mobile/src/theme/fonts.ts',
      'apps/mobile/src/theme/faceFor.ts',
      'apps/mobile/src/theme/faceFor.test.ts',
      'apps/mobile/src/components/Text.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
