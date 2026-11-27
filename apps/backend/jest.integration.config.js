const dbConfig = require('./jest.db.config');

module.exports = {
  ...dbConfig,
  testRegex: '\\.int-spec\\.ts$',
  setupFiles: [...dbConfig.setupFiles, '<rootDir>/test/integration/env.js'],
};
