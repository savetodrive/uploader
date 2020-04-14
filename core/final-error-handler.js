const os = require('os');
const Sentry = require('@sentry/node');

const shutdownProcess = (error) => {
  global.logger.error(error);
  process.exit(1);
};

module.exports = (callback) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_NODE_RAVEN_DSN,
      release: process.env.CURRENT_REVISION,
      environment: process.env.APP_ENVIRONMENT,
      serverName: os.hostname(),
    });
    Sentry.configureScope((scope) => {
      scope.setTag('app_type', 'uploader_microservice');
    });
  } else {
    process.on('uncaughtException', callback || shutdownProcess);
    process.on('unhandledRejection', callback || shutdownProcess);
  }
};
