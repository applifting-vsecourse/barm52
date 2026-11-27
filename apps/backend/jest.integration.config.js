const dbConfig = require('./jest.db.config');

module.exports = {
  ...dbConfig,
  moduleFileExtensions: [...dbConfig.moduleFileExtensions, 'tsx'],
  testRegex: '\\.int-spec\\.ts$',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  setupFiles: [...dbConfig.setupFiles, '<rootDir>/test/integration/env.js'],
};
