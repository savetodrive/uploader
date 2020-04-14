const BoxSDK = require('box-node-sdk');
const request = require('request');
const autobind = require('auto-bind');
const Progress = require('../Progress');
const wrap = require('streams2');
const Drive = require('./Drive');

const { BOX_CLIENT_ID, BOX_CLIENT_SECRET } = process.env;
class Box extends Drive {
  constructor() {
    super();
    autobind(this);
    this.OAUTH_LINK = 'https://account.box.com/api/oauth2/authorize';
    this.ACCESS_TOKEN_LINK = 'https://api.box.com/oauth2/token';
    this.UPLOAD_LINK = 'https://upload.box.com/api/2.0/files/content';
  }
  init() {
    this.sdk = new BoxSDK({
      clientID: BOX_CLIENT_ID,
      clientSecret: BOX_CLIENT_SECRET,
    });
  }

  upload(context, progressLogger, stepLogger) {
    this.init();
    const requestStream = this.getSourceStream();
    const pg = new Progress(context.meta.size);

    const consume = function consume(stream, consumer) {
      function flow() {
        let chunk = stream.read();
        while (chunk !== null) {
          consumer(chunk);
          chunk = stream.read();
        }
      }

      flow();
      stream.on('readable', flow);
    };

    consume(wrap(requestStream), (chunk) => {
      pg.flow(
        chunk,
        ({ pretty }) => {
          progressLogger({ progress: pretty, fileId: context.meta.uuid });
        },
      );
    });
    const client = this.sdk.getBasicClient(this.getAccessToken());
    requestStream.on('end', () => {
      this.aborted();
    });
    const folder = context.destinationMeta ? context.destinationMeta.data.activeFolder.id : '0';
    client.files.uploadFile(folder, context.meta.name, requestStream, (error, success) => {
      if (error) {
        stepLogger(error.message, 'error');
        return this.wrap(error, null);
      }
      stepLogger('File has been uploaded successfully.', 'info');
      return this.wrap(null, success);
    });
  }

  getFileStream(meta) {
    this.init();
    return new Promise((resolve, reject) => {
      const client = this.sdk.getBasicClient(this.getAccessToken());
      client.files.getReadStream(meta.data.item.id, null, (error, stream) => {
        if (error) {
          return reject(error);
        }

        return resolve(stream);
      });
    });
  }
}

module.exports = Box;
