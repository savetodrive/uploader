require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
    require('raven').config(process.env.SENTRY_NODE_RAVEN_DSN).install();
}

const logger = require('../core/loggerFactory');

global.logger = logger();

process.on('uncaughtException', global.logger.error);

process.on('unhandledRejection', reason => {
  global.logger.error(reason);
});

throw new Error()

