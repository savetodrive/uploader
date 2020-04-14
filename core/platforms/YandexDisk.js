const request = require('request');
const prettysize = require('prettysize');
const prettyTime = require('pretty-time');
const progressStream = require('../StreamProgress');
const Drive = require('./Drive');
const autobind = require('auto-bind');

class YandexDisk extends Drive {
  constructor() {
    super();
    autobind(this);
  }
  upload(options, progressLogger, stepLogger) {
    const progressStreamable = progressStream(
      {
        time: 1000,
      },
      (progress) => {
        const formattedProgress = Object.assign({}, progress);
        formattedProgress.percentage = Math.round(progress.percentage);
        formattedProgress.transferred = prettysize(progress.transferred);
        formattedProgress.remaining = prettysize(progress.remaining);
        formattedProgress.speed = `${prettysize(progress.speed)}ps`;
        if (progress.eta) {
          formattedProgress.eta = prettyTime(progress.eta * 1000000000);
        }
        progressLogger({
          progress: formattedProgress,
          fileId: options.meta.uuid,
        });
      },
    );
    progressStreamable.setLength(options.meta.size);
    stepLogger('File from url has been found, Uploading to Yandex Disk.', 'info');
    const savePath =
      options.destinationMeta && options.destinationMeta.data.activeFolder.id !== 'root'
        ? `${options.destinationMeta.data.activeFolder.id}/${encodeURIComponent(options.meta.name)}`
        : `app:/${encodeURIComponent(options.meta.name)}`;
    request.get(
      'https://cloud-api.yandex.net/v1/disk/resources/upload',
      {
        qs: {
          overwrite: true,
          path: savePath,
        },
        headers: {
          Authorization: `OAuth ${this.getAccessToken()}`,
        },
      },
      (err, response, body) => {
        if (err || response.statusCode > 299) {
          return this.wrap(err || new Error('Unable to create upload session.'), null);
        }
        const formattedBody = JSON.parse(body);

        let stream = this.getSourceStream();
        stream = stream.pipe(progressStreamable);
        if (!stream.pipe) return new Error('Some error occurred.');
        stream
          .pipe(request.put(formattedBody.href, (uploadError) => {
            if (uploadError) {
              return this.wrap(uploadError, null);
            }

            if (response.statusCode > 399) {
              stepLogger('Error uploading file, Check size or Authenticate again.', 'error');
              return this.wrap(
                new Error('Error uploading file, Check size or Authenticate again.'),
                null,
              );
            }

            stepLogger('File has been uploaded successfully.', 'success');
            return this.wrap(null, 'File uploaded');
          }))
          .on('error', (streamError) => {
            this.wrap(streamError.message);
            this.closeStream(stream);
          })
          .on('end', () => {
            this.aborted();
          });
      },
    );
  }
  getFileStream(meta) {
    return new Promise((resolve, reject) => {
      request(
        {
          url: 'https://cloud-api.yandex.net/v1/disk/resources/download',
          qs: {
            path: meta.data.item.id,
          },
          headers: {
            Authorization: `OAuth ${this.getAccessToken()}`,
          },
        },
        (err, http, response) => {
          if (err || http.statusCode > 299) {
            return reject(err || new Error('Failed.'));
          }

          const url = JSON.parse(response).href;
          const stream = request.get(url);
          const stream1 = request.get(url);
          stream1.pipe(require('fs').createWriteStream('text.jpg'));
          return resolve(stream);
        },
      );
    });
  }
}

module.exports = YandexDisk;
