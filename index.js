process.chdir(__dirname);
require('dotenv').config();

const { spawn } = require('child_process');
const kue = require('kue');
const { promisify } = require('util');

const appState = require('./core/app-state');
const finalErrorHandler = require('./core/final-error-handler');
const blockedHandler = require('./core/blocked-handler');
const Uploader = require('./core/Uploader');
const loggerFactory = require('./core/loggerFactory');
const utils = require('./core/utils.js');

appState.mode = 'initiating';

global.logger = loggerFactory();

const uploader = Uploader.getInstance();
uploader.init();
uploader.getQueue().watchStuckJobs(5000); // ms

const consumer = uploader.createConsumer();
consumer.handle();

if (process.send) {
  process.send('ready');
}

appState.mode = 'running';

const finalizeLogging = () => {
  const loggingPromise = new Promise((resolve, reject) => {
    const loggingTimeout = setTimeout(reject, 1500);
    global.logger.on('finish', () => {
      clearTimeout(loggingTimeout);
      resolve();
    });
  });

  global.logger.end();

  return loggingPromise;
};

const shutdownProcess = async (options) => {
  appState.mode = 'terminating';

  let failed = false;

  if (options.error) {
    global.logger.error(options.error);
    failed = true;
  }

  const exitHandler = (promise, ignoreFailure = false) =>
    Promise.resolve(promise).catch((err) => {
      if (!ignoreFailure) {
        global.logger.error(err);
        failed = true;
      }
    });

  try {
    await Promise.all([
      // try to exit immediately in case of failure
      // otherwise wait for some time to stop the currently active jobs
      exitHandler(uploader.shutdownQueue(failed ? 0 : (options.uploadTasksTimeout || 1000))),
      (() => {
        if (options.error) {
          global.logger.error(options.error);
        }
      })(),
    ]);

    global.logger.debug('All kue workers shut down.');

    await promisify(consumer.stop.bind(consumer))();

    global.logger.debug('All thekdar workers shut down.');

    await Promise.all([
      exitHandler(utils.quitRedis(uploader.publisher)),
      exitHandler(kue.redis.reset()), // Quits all the redis connection used internally by kue
    ]);

    global.logger.debug('Redis connection closed(failure ignored).');
  } catch (error) {
    failed = true;
    global.logger.error(error);
  } finally {
    try {
      await exitHandler(finalizeLogging(), true);

      if (options.preExitCallback) {
        await options.preExitCallback();
      }
    } catch (e) {
      failed = true;
      console.error(e.stack); // eslint-disable-line
    }

    process.exit(failed ? 1 : 0);
  }
};


process.on('SIGUSR1', () => {
  global.logger.info('Received SIGUSR1 signal.');

  uploader.stop();
  return shutdownProcess({
    uploadTasksTimeout: 5 * 60 * 60 * 1000,
    preExitCallback: async () => {
      if (process.env.NODE_ENV === 'production' && process.env.FOREVER_UID) {
        await promisify(spawn)('forever', ['stop', process.env.FOREVER_UID], { detached: true });

        // wait 2 sec for "Forever" to stop the process
        utils.delay(2000);
      }
    },
  });
});

finalErrorHandler(error => shutdownProcess({ error }));

blockedHandler();
