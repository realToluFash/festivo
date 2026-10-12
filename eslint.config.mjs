import js from '@eslint/js';
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
];
