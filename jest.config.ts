import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  // Fuera de la cobertura: los tests de integración (si no se corren, contarían
  // como código sin cubrir), sus utilidades y el arranque.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.int-spec.ts',
    '!src/common/testing/**',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage',
  // Lo exige el curso: el CI (npm run test:cov) falla bajo el 60%.
  coverageThreshold: {
    global: { lines: 60, statements: 60, branches: 60, functions: 60 },
  },
  testEnvironment: 'node',
};

export default config;
