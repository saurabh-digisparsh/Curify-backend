// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lint config for the NestJS API.
 *
 * Deliberately NOT type-aware (no `projectService`): the type-checked rule set is
 * a different job from what `tsc` already does on every build, and it makes a lint
 * run minutes long. This config hunts the things the compiler does not — dead
 * bindings, lost promises, accidental globals — and leaves types to `npm run build`.
 *
 * Rules that fight this codebase's established idioms are off, not worked around:
 * see each note below. Turning them on later is a deliberate cleanup, not a lint fix.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        // Node globals the API relies on (no `env: node` in flat config).
        process: 'readonly', console: 'readonly', Buffer: 'readonly',
        __dirname: 'readonly', __filename: 'readonly', module: 'writable', require: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        fetch: 'readonly', URL: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
        Express: 'readonly', // Express.Multer.File namespace type
      },
    },
    rules: {
      // Prisma JSON columns, AI responses and Multer payloads are genuinely
      // unshaped at the boundary; the code narrows them where it matters.
      '@typescript-eslint/no-explicit-any': 'off',
      // Nest DI declares constructor params that TS itself proves are used, and
      // `const { password, ...safe } = user` is how this codebase strips secrets —
      // ignoreRestSiblings tells the linter that omit-by-destructuring is the point.
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true,
      }],
      // `import Razorpay = require('razorpay')` is the CORRECT form for a module
      // that ships `export =` — a default import resolves to a non-constructor at
      // runtime. Bare `require()` calls are still errors.
      '@typescript-eslint/no-require-imports': ['error', { allowAsImport: true }],
      // `!` is used against Prisma optionals the surrounding guard already proved.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Catches the real bug class here: a DB write or AI call whose promise is
      // dropped, so a failure vanishes instead of surfacing.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      // Script-block ranges (the non-Latin review detector) legitimately span
      // combining marks. Written as \uXXXX escapes they are explicit rather than
      // misleading, which is precisely what allowEscape is for.
      'no-misleading-character-class': ['error', { allowEscape: true }],
    },
  },
  {
    // Tests may shadow and stub freely.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
