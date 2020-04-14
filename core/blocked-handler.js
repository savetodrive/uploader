const blocked = require('blocked-at');

const appState = require('./app-state');

module.exports = () => {
  if (process.env.NODE_ENV === 'production' && appState.mode !== 'terminating') {
    blocked((ms, stack) => {
      stack.unshift(`Error: Blocked for ${ms}`);
      const err = new Error(`Blocked for ${ms}`);
      err.trace = stack.join('\n');
      global.logger.warn(err);
    });
  }
};
