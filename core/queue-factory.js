const kue = require('kue');
const utils = require('./utils');

exports.create = (jobEvents = false) => {
  const { env } = process;

  const createRedisClient = utils.createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  });

  return kue.createQueue({
    prefix: 'std_q',
    redis: {
      createClientFactory: createRedisClient,
    },
    jobEvents,
  });
};
