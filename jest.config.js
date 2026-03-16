'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'background.js',
    'options.js',
    'utils.js',
    '!jest.setup.js',
    '!jest.config.js',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  // Automatically clear mock state between every test
  clearMocks: true,
};
