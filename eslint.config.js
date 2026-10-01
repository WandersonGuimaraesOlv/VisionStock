import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // Páginas do Portal de Acesso: scripts clássicos que compartilham as funções de comum.js
    files: ['portal-acesso/app/static/**/*.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['portal-acesso/app/static/painel.js'],
    languageOptions: { globals: { api: 'readonly', el: 'readonly', sair: 'readonly', BASE: 'readonly' } },
  },
])
