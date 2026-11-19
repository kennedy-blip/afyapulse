module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react'],
  settings: { react: { version: 'detect' } },
  globals: { React: 'readonly' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|_)$', caughtErrors: 'none' }],
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-vars': 'error',
    'react-hooks/exhaustive-deps': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
}
