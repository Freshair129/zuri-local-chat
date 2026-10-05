module.exports = {
  testEnvironment: 'node',
  transform: {},
  testMatch: [__dirname.replaceAll('\\', '/') + '/.build/test/**/*.test.js'],
  testTimeout: 5000,
};
