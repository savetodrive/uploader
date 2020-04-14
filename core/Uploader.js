const kue = require('kue');
const Thekdar = require('thekdar');
const { promisify } = require('util');
const ThekdarUi = require('thekdar-ui');
const differenceInMinutes = require('date-fns/difference_in_minutes');

const Consumer = require('./Consumer');
const utils = require('./utils');

const { env } = process;

const createRedisClient = utils.createRedisClient({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
});
class Uploader {
  constructor() {
    if (Uploader.INSTANCE) {
      throw new Error('Uploader Instance already created');
    }
    this._queue = null;
    this._thekdar = null;
  }

  init() {
    this._queue = kue.createQueue({
      prefix: 'std_q',
      redis: {
        createClientFactory: createRedisClient,
      },
      jobEvents: false,
    });
    this._queue.setMaxListeners(1000);
    this.publisher = createRedisClient();
    this.publisher.auth(env.REDIS_PASSWORD);
    this._thekdar = new Thekdar({
      queue: {
        filter(task, cb) {
          const diffInMinutes = differenceInMinutes(Date.now(), +task.created);
          if (diffInMinutes > +env.TASK_REJECTION_MINUTE_OF_QUEUE) {
            return cb(new Error('Task expired please try again.'));
          }
          return cb(null, task);
        },
      },
    });
    this._thekdar.setMaxWorker(process.env.MAX_WORKER);
    this._thekdar.setMaxTaskPerWorker(process.env.MAX_TASK_PER_WORKER);
    this._thekdar.addWorkerAddress('./core/workers/fork.js', Thekdar.Task.TYPE_FORK);
    this._thekdar.deployWorkers();
    this._thekdar.addPluggin(new ThekdarUi({
      port: env.THEKDAR_UI_PORT,
      pidUsage: false,
    }));
  }
  stop() {
    this._thekdar.stop();
  }
  getQueue() {
    return this._queue;
  }

  static getInstance() {
    if (!Uploader.INSTANCE) {
      Uploader.INSTANCE = new Uploader();
    }

    return Uploader.INSTANCE;
  }

  createConsumer() {
    return new Consumer(this._queue, this._thekdar, this.publisher);
  }

  shutdownQueue(timeout) {
    return promisify(this._queue.shutdown.bind(this._queue))(timeout);
  }
}

Uploader.INSTANCE = null;
module.exports = Uploader;
