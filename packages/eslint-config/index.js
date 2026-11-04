import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import sveltePlugin from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config for the web apps and packages.
 *
 * - Errors: likely bugs (undefined names, unsafe comparisons, framework misuse).
 * - Warnings: code that works but should be tidied up (unused code, console logs).
 * Formatting is left to Prettier and .editorconfig (eslint-config-prettier
 * turns off the style rules that would conflict with them).
 */

const unusedVars = ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }];

export const base = [
    { ignores: ['dist/', 'node_modules/', 'coverage/'] },
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        },
        rules: {
            // Errors: likely bugs
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'no-implicit-globals': 'error',
            'no-promise-executor-return': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            'no-unmodified-loop-condition': 'error',
            'no-unreachable-loop': 'error',
            'no-constructor-return': 'error',

            // SQL injection: queries go through Drizzle ORM, which sends values as parameters.
            'no-restricted-syntax': [
                'error',
                {
                    selector: "MemberExpression[object.name='sql'][property.name='raw']",
                    message:
                        'sql.raw() puts text straight into the SQL. Build the query with Drizzle, or put values in a sql`…` template (sent as parameters) and names in sql.identifier().',
                },
                {
                    selector: "ImportSpecifier[imported.name='sql'][local.name!='sql']",
                    message: "Import Drizzle's sql tag as `sql`, so the sql.raw() check can see it.",
                },
                {
                    selector:
                        'CallExpression[callee.property.name=/^(exec|run|prepare)$/] > TemplateLiteral.arguments:first-child[expressions.length>0]',
                    message:
                        'This builds SQL from a template string. Use a Drizzle query, or pass values as parameters instead.',
                },
                {
                    selector:
                        "CallExpression[callee.property.name=/^(exec|run|prepare)$/] > BinaryExpression.arguments:first-child[operator='+']",
                    message:
                        'This builds SQL by joining strings. Use a Drizzle query, or pass values as parameters instead.',
                },
            ],

            // Functions are const arrow functions; class methods stay methods.
            'func-style': ['error', 'expression'],
            'prefer-arrow-callback': 'error',
            // Arrow functions aren't hoisted, so catch calls that run before the definition.
            'no-use-before-define': ['error', { functions: true, classes: true, variables: false }],

            // Warnings: clean-up worth doing
            'no-unused-vars': unusedVars,
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'prefer-const': 'warn',
            'object-shorthand': 'warn',
            'no-useless-rename': 'warn',
            'no-useless-concat': 'warn',
            'no-else-return': ['warn', { allowElseIf: false }],
        },
    },
];

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

export const typescript = [
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: config.files ?? tsFiles })),
    {
        files: tsFiles,
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': unusedVars,
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': [
                'error',
                { functions: true, classes: true, variables: false, typedefs: false },
            ],
            '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
        },
    },
];

export const svelte = (svelteConfig) => [
    ...sveltePlugin.configs.recommended,
    ...sveltePlugin.configs.prettier,
    {
        files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: { svelteConfig, parser: tseslint.parser, extraFileExtensions: ['.svelte'] },
        },
        rules: {
            'svelte/no-at-html-tags': 'error',
            'svelte/require-each-key': 'error',
            'svelte/valid-compile': 'error',
            'svelte/no-unused-svelte-ignore': 'warn',
            'svelte/prefer-class-directive': 'warn',
            'svelte/no-useless-mustaches': 'warn',
            // Svelte's version understands `let { … } = $props()`.
            'prefer-const': 'off',
            'svelte/prefer-const': 'warn',
        },
    },
];

const jsxFiles = ['**/*.jsx', '**/*.tsx'];

export const react = [
    { ...eslintReact.configs['recommended-typescript'], files: jsxFiles },
    { ...reactHooks.configs.flat['recommended-latest'], files: jsxFiles },
    {
        files: jsxFiles,
        languageOptions: {
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: {
            '@eslint-react/rules-of-hooks': 'off',
        },
    },
];

// Config files, scripts and tests run in Node.
export const node = [
    {
        files: ['*.config.{js,ts,mjs}', '**/*.test.{js,ts,jsx,tsx}', 'scripts/**/*.{js,mjs}'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
