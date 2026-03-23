const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['node_modules/', '.expo/', 'dist/'],
  },
  {
    // テストファイルでの Jest require() モックと匿名ラッパーコンポーネントを許可
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      'react/display-name': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])
