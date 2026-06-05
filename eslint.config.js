import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react':        reactPlugin,
      'react-hooks':  reactHooksPlugin,
    },
    rules: {
      // ── TypeScript ─────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any':        'warn',
      '@typescript-eslint/no-unused-vars':         ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion':  'warn',

      // ── React ──────────────────────────────────────────────────
      'react/jsx-uses-react':   'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/self-closing-comp': ['warn', { component: true, html: false }],
      'react/no-array-index-key': 'warn',

      // ── General quality ────────────────────────────────────────
      'no-console':   ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      'prefer-const': 'error',
      'no-var':       'error',
      'eqeqeq':       ['error', 'always'],
      'no-debugger':  'error',
      'no-alert':     'warn',
      'curly':        ['warn', 'multi-line'],

      // ── Security ───────────────────────────────────────────────
      'no-eval':        'error',
      'no-new-func':    'error',
      'no-script-url':  'error',

      // ── Imports ────────────────────────────────────────────────
      'no-duplicate-imports': 'error',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    // Relaxed rules for test files
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  },
];
