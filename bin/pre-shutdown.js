#!/usr/bin/env node
const path = require('path');

require('dotenv').config({ path: path.resolve(path.dirname(__dirname), '.env') });

const queueFactory = require('../core/queue-factory');
const loggerFactory = require('../core/loggerFactory');

const queue = queueFactory.create(true);
const logger = loggerFactory(true);

const job = queue.create('std_sleep_uploader', {
  uploaderServerHostname: process.env.HOST_NAME,
});
job.save();

job.on('complete', () => process.exit(0));

job.on('failed', (errorMessage) => {
  logger.error(errorMessage instanceof Error ? errorMessage : new Error(errorMessage));
  process.exit(1);
});

setTimeout(() => {
  logger.error(new Error('2 second Timeout occurred while informing distributor about uploader shutdown'));
}, 2000);
