/**
 * We will use this Noop whenever we dont need to upload any file to any cloud on development
 * this will just mock upload feature and write to local system
 */
const autobind = require('auto-bind');
const fs = require('fs');
const path = require('path');
const Drive = require('./Drive');
const Progress = require('../Progress');
const Throttle = require('throttle');

class Noop extends Drive {
  constructor() {
    super();
    autobind(this);
  }

  upload(context, progressLogger, stepLogger) {
    const stream = this.getSourceStream();
    const pg = new Progress(context.headers['content-length']);

    stepLogger('pCloud upload session has been started.', 'info');
    stream.on('data', (chunk) => {
      pg.flow(
        chunk,
        ({ raw, pretty }) => {
          progressLogger({ progress: pretty, fileId: context.meta.uuid });
        },
      );
    });
    stream.on('error', (streamError) => {
      console.log('error');
      this.wrap(streamError.message);
      this.closeStream(stream);
    });

    // setTimeout(() => {
    //   stream.abort(new Error('fucckkk'));
    // }, 5000);
    stream
      .on('end', () => {
        if (!this.aborted()) {
          stepLogger('File has been uploaded successfully.', 'success');
          this.wrap(null, {});
        }
      })

      .pipe(fs.createWriteStream(path.join(__dirname, '../../noop', context.meta.name)));
  }
}
module.exports = Noop;
