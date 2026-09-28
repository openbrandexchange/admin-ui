// Lint: TypeScript + React hooks + accessibility (jsx-a11y). Type errors are tsc's job
// (`npm run typecheck`); this catches hook mistakes and inaccessible markup.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  { ignores: ['dist', 'dist-mock', 'node_modules', 'test-results', 'playwright-report', 'mock-public', 'src/api/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // Labels are associated through the Field render prop (htmlFor + id), which the rule cannot follow.
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
      // Single-purpose public pages (login, reset, each setup step) focus their first field on
      // purpose: it is where every visitor starts, and it moves focus to a new wizard step.
      'jsx-a11y/no-autofocus': 'off',
      // Horizontally scrolling tables and code blocks must be reachable by keyboard (axe
      // scrollable-region-focusable, WCAG 2.1.1), so they carry tabIndex={0} with a label.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'], tags: ['pre'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
)
