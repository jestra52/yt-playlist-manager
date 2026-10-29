import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/**
 * ESLint flat config for the Svelte web app.
 *
 * - Errors: likely bugs (undefined names, unsafe comparisons, Svelte misuse).
 * - Warnings: code that works but should be tidied up (unused code, console logs).
 * Formatting is left to Prettier and .editorconfig (eslint-config-prettier
 * turns off the style rules that would conflict with them).
 */
export default [
    { ignores: ['dist/', 'node_modules/'] },

    js.configs.recommended,
    ...svelte.configs.recommended,
    prettier,
    ...svelte.configs.prettier,

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
            'svelte/no-at-html-tags': 'error',
            'svelte/require-each-key': 'error',
            'svelte/valid-compile': 'error',

            // Functions are const arrow functions; class methods stay methods.
            'func-style': ['error', 'expression'],
            'prefer-arrow-callback': 'error',
            // Arrow functions aren't hoisted, so catch calls that run before the definition.
            'no-use-before-define': ['error', { functions: true, classes: true, variables: false }],

            // Warnings: clean-up worth doing
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'prefer-const': 'warn',
            'object-shorthand': 'warn',
            'no-useless-rename': 'warn',
            'no-useless-concat': 'warn',
            'no-else-return': ['warn', { allowElseIf: false }],
            'svelte/no-unused-svelte-ignore': 'warn',
            'svelte/prefer-class-directive': 'warn',
            'svelte/no-useless-mustaches': 'warn',
        },
    },

    // Svelte components and runes modules (*.svelte.js) need the Svelte parser config.
    {
        files: ['**/*.svelte', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: { svelteConfig },
        },
        rules: {
            // Svelte's version understands `let { … } = $props()`.
            'prefer-const': 'off',
            'svelte/prefer-const': 'warn',
        },
    },

    // Config files and tests run in Node.
    {
        files: ['*.config.js', '**/*.test.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
