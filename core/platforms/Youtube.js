const request = require('request');
const prettysize = require('prettysize');
const progressStream = require('../StreamProgress');
const prettyTime = require('pretty-time');
const autobind = require('auto-bind');
const Drive = require('./Drive');

class Youtube extends Drive {
  constructor() {
    super();
    autobind(this);
  }
  upload(options, progressLogger, stepLogger) {
    const uploadOptions = {
      url:
        'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&autoLevels=false&stabilize=false',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    };

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
    stepLogger('Media from url has been found, Uploading to Youtube', 'info');
    const stream = this.getSourceStream();
    stream.on('error', (streamError) => {
      this.wrap(streamError.message);
      this.closeStream(stream);
    });
    stream
      .pipe(progressStreamable)
      .pipe(request.post(uploadOptions, (error, status, body) => {
        if (error) {
          return this.wrap(error, null);
        }

        const result = JSON.parse(body);
        if (result.error) {
          stepLogger('Error uploading file.', 'error');
          return this.wrap(
            new Error(result.error.message ||
                  'Error uploading file, Check drive size or Authenticate again.'),
            null,
          );
        }
        const updation = {
          url: 'https://www.googleapis.com/youtube/v3/videos?part=snippet,status',
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          json: {
            id: result.id,
            snippet: {
              categoryId: result.snippet.categoryId,
              title: options.meta.name,
              description: 'Uploaded from SaveToDrive.',
            },
            status: {
              privacyStatus: 'private',
            },
          },
        };

        stepLogger('Media has been uploaded processing is going on', 'info');
        return request(updation, (err, updateResponse, updateBody) => {
          if (err || result.error) {
            stepLogger(
              'Problem occurred when updating Media please check if size available.',
              'error',
            );
            return this.wrap(
              new Error('Problem occurred when updating Media please check if size available.'),
              null,
            );
          }
          stepLogger('Media has been uploaded successfully.', 'success');
          return this.wrap(null, updateBody);
        });
      }))
      .on('error', err => this.wrap(err, null))
      .on('end', () => {
        this.aborted();
      });
  }
}

module.exports = Youtube;
