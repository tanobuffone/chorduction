export default {
  testEnvironment: 'node',
  verbose: true,
  transform: {},
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
  ],
  // Exclude legacy root-level test file and e2e setup helpers from test run
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/chorduction.test.js',      // legacy v6 monolith test
    '/tests/e2e/setup/',               // mock helpers, not test suites
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/types.js',                   // typedef-only, no runtime code
  ],
  coverageThreshold: {
    global:          { lines: 70, functions: 65 },
    './src/core/':   { lines: 90 },
    './src/cache/':  { lines: 90 },
    './src/export/': { lines: 85 },
    './src/ml/':     { lines: 75 },
    './src/utils/':  { lines: 80 },
  },
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  // Allow ESM syntax from src/ (esbuild target is ESM)
  extensionsToTreatAsEsm: ['.js'],
};
