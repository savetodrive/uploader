const winston = require('winston');
const Transport = require('winston-transport');
const path = require('path');
const LogzioWinstonTransport = require('winston-logzio');
const Sentry = require('@sentry/node');
const os = require('os');

const {
  combine,
  timestamp,
  json,
  colorize,
  printf,
} = winston.format;

class SentryExceptionLogger extends Transport {
  constructor(opts) {
    super(opts);
    this.name = 'sentry';
    this.level = 'error';
  }

  async log(error, callback) { // eslint-disable-line class-methods-use-this
    await Sentry.captureException(error);

    // wait 1 sec for the logging to be completed
    // TODO: find a better mechanism to wait for the logging to be done
    setTimeout(callback, 1000);
  }
}

module.exports = (isConsoleCommand = false) => {
  const transports = [
    new winston.transports.File({
      level: 'info',
      filename: path.resolve('./logs/all-logs.log'),
    }),
  ];

  if (process.env.NODE_ENVIRONMENT !== 'production') {
    transports.push(new winston.transports.Console({
      level: 'debug',
    }));
  } else {
    transports.push(new LogzioWinstonTransport({
      level: 'info',
      name: 'winston_logzio',
      token: process.env.LOGZ_IO_TOKEN,
    }));
    transports.push(new SentryExceptionLogger());
  }

  if (isConsoleCommand && process.env.NODE_ENVIRONMENT === 'production') {
    transports.push(new winston.transports.Console({
      level: 'info',
    }));
  }

  const prodFormat = () => {
    const replaceError = ({
      label, level, message, stack,
    }) => ({
      label, level, message, stack,
    });
    const replacer = (key, value) => (value instanceof Error ? replaceError(value) : value);
    return combine(timestamp(), json({ replacer }));
  };

  const devFormat = () => {
    const formatMessage = info => `${info.level} ${info.message}`;
    const formatError = info => `${info.level} ${info.message}\n\n${info.stack}\n`;
    const format = info => (info instanceof Error ? formatError(info) : formatMessage(info));
    return combine(colorize(), printf(format));
  };

  const logger = winston.createLogger({
    level: process.env.NODE_ENVIRONMENT === 'production' ? 'info' : 'silly',
    transports,
    exitOnError: false,
    defaultMeta: { app_type: 'uploader_microservice', serverName: os.hostname() },
    format: process.env.NODE_ENVIRONMENT === 'production' ? prodFormat() : devFormat(),
  });

  logger.emitErrs = true;

  return logger;
};
