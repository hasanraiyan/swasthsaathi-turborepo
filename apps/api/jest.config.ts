import type { Config } from 'jest';

const common = {
  moduleFileExtensions: ['js', 'json', 'ts'] as const,
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testEnvironment: 'node' as const,
};

const config: Config = {
  projects: [
    {
      ...common,
      displayName: 'unit',
      rootDir: 'src',
      testMatch: ['<rootDir>/**/*.spec.ts'],
    },
    {
      ...common,
      displayName: 'integration',
      rootDir: '.',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
    },
    {
      ...common,
      displayName: 'e2e',
      rootDir: '.',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
    },
  ],
};

export default config;
