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
      'dist/**',
      'build/**',
      '**/ios/**',
      '**/android/**',
      '.agents/**',
      'services/api/var/**',
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
    files: ['scripts/**/*.mjs', '**/*.config.{js,mjs,ts}'],
    rules: { 'no-console': 'off' },
  },
];
