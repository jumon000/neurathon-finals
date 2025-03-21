#!/bin/bash
cd ..
cd apps/backend
npm init -y
npm install typescript --save-dev
npx tsc --init
npm install express
npm install --save-dev eslint @eslint/js typescript-eslint @stylistic/eslint-plugin @types/express @types/eslint__js
touch eslint.config.mjs
cat>>eslint.config.mjs<<EOF
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config({
  files: ['**/*.ts'],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
  ],
  languageOptions: {
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    "@stylistic": stylistic,
  },
  rules: {
    '@stylistic/semi': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { 'argsIgnorePattern': '^_' }
    ],
  },
});
EOF
npm install --save-dev ts-node-dev
