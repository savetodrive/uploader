#!/usr/bin/env node
const path = require('path');

require('dotenv').config({ path: path.resolve(path.dirname(__dirname), '.env') });

const queueFactory = require('../core/queue-factory');

const queue = queueFactory.create(true);

const job = queue.create('std_sync_uploads_count', {
  count: 0,
  uploaderServerHostname: process.env.HOST_NAME,
});
job.save();

job.on('complete', () => process.exit(0));
