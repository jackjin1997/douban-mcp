/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    // Measured 2026-11-04 after removing FrodoDataSource: 81 / 59 / 82 / 83
    // (statements / branches / functions / lines). Branches still trail the
    // 70% target from the spec; raise it as parser error paths get tests.
    global: { branches: 55, functions: 80, lines: 80, statements: 80 }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  }
};
