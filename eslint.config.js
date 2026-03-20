import tseslint from '@typescript-eslint/eslint-plugin'
import parser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'assets/**'],
  },
  {
    files: ['**/*.ts'],

    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // correctness
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],

      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',

      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',

      // sanity
      'no-console': 'off',
      'prefer-const': 'error',
    },
  },
]
