const security = require('eslint-plugin-security');

const browserGlobals = {
    Blob: 'readonly',
    ClassicEditor: 'readonly',
    DOMParser: 'readonly',
    File: 'readonly',
    FormData: 'readonly',
    Intl: 'readonly',
    XMLSerializer: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    atob: 'readonly',
    confirm: 'readonly',
    crypto: 'readonly',
    document: 'readonly',
    globalThis: 'readonly',
    localStorage: 'readonly',
    location: 'readonly',
    module: 'readonly',
    navigator: 'readonly',
    prompt: 'readonly',
    window: 'readonly'
};

module.exports = [
    {
        ignores: [
            'assets/data/**',
            'assets/vendor/**',
            'node_modules/**'
        ]
    },
    {
        files: ['assets/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'script',
            globals: browserGlobals
        },
        plugins: {
            security
        },
        rules: {
            ...security.configs.recommended.rules,
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-script-url': 'error',
            'security/detect-object-injection': 'off'
        }
    },
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                Buffer: 'readonly',
                process: 'readonly'
            }
        },
        plugins: {
            security
        },
        rules: {
            ...security.configs.recommended.rules,
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'security/detect-object-injection': 'off',
            'security/detect-non-literal-fs-filename': 'off',
            'security/detect-unsafe-regex': 'off'
        }
    }
];
