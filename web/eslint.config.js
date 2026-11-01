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
        files: ['*.config.js', '**/*.test.js', 'scripts/**/*.mjs'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
