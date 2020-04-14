require('dotenv').config();
const kue = require('kue');
const Uploader = require('../core/Uploader');
const uuid = require('uuid');

const uploader = Uploader.getInstance();
uploader.init();

const env = process.env;
const queue = uploader.getQueue();
const numberOfJobs = +process.argv[2] || 1;
console.log(numberOfJobs);
for (i = 0; i < numberOfJobs; i++) {
  const job = queue
    .create(`${env.SERVER_UPLOAD_QUEUE_PREFIX}_${env.HOST_NAME}`, {
      url: 'http://ipv4.download.thinkbroadband.com/512MB.zip',
      headers: {
        'x-powered-by': 'Express',
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'content-length': '10185',
        etag: 'W/"27c9-1qOxpkg+c89MRHyou6NTcQ"',
        'set-cookie': [
          'connect.sid=s%3AoecA-lFTxkrFsy17PE6XdWvXmuRQQszk.SSLMFjF2oF7FPVbwP2Cuo7vnQyAZRPnz%2Bond5smlyRk; Path=/; HttpOnly',
        ],
        date: 'Sun, 11 Mar 2018 19:33:02 GMT',
        connection: 'close',
      },
      meta: {
        name: '#',
        uuid: uuid(),
        size: '9.9 kB',
        type: 'html',
        started_at: 1520796782043,
        url: 'http://ipv4.download.thinkbroadband.com/5MB.zip',
        progress: {
          percentage: 0,
          transferred: '0 kB',
          remaining: '0 Bytes',
          eta: 0,
          runtime: 1,
          delta: 0,
          speed: '0 kBps',
        },
      },
      cloud: 'dropbox',
      accessToken: 'jF5atVO05MAAAAAAAAAAGke8zocE86oitmXUsUOx_vgPdzCAZpbExA_pCLUaA6sP',
      sessionId: 'cWV0q8sAH7BpIqitWWnDVd0kA0bYJjmN',
      __distributor: {
        uploaderServerId: '5a623e48d83c9876c368a8d6',
      },
    })
    .priority('low')
    .save();

  job.on('error', console.log);
  job.on('complete', console.log);
}
setTimeout(() => {
  process.exit();
}, 5000);
