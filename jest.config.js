/**
 * Jest — SindiFlow
 * Obrigação §4.1: TDD obrigatório com cobertura mínima mensurável.
 */
module.exports = {
  coverageThreshold: {
    './src/domain/': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/application/': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    './src/adapters/': {
      statements: 70,
      branches: 60,
      functions: 60,
      lines: 70,
    },
  },
  projects: [
    {
      displayName: 'core',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.spec.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      clearMocks: true,
      collectCoverageFrom: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/adapters/**/*.ts',
      ],
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '\\.d\\.ts$',
        'src/infra/db/expo-sqlite.executor.ts',
      ],
    },
  ],
};
