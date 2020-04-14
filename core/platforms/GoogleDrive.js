const request = require('request');
const prettysize = require('prettysize');
const autobind = require('auto-bind');
const progressStream = require('../StreamProgress');
const prettyTime = require('pretty-time');
const Drive = require('./Drive');

class GoogleDrive extends Drive {
  constructor() {
    super();
    autobind(this);
  }
  upload(options, progressLogger, stepLogger) {
    global.logger.info('Starting Google Drive upload');
    const uploadOptions = {
      url: ' https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
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
    stepLogger('File from url has been found, Uploading to Google Drive', 'info');
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
        try {
          const result = JSON.parse(body);

          if (result.error) {
            stepLogger('Error uploading file, Check drive size or Authenticate again.', 'error');
            return this.wrap(
              new Error('Error uploading file, Check drive size or Authenticate again.'),
              null,
            );
          }
          const folder = options.destinationMeta
            ? options.destinationMeta.data.activeFolder.id
            : 'root';
          const updation = {
            url: `https://www.googleapis.com/drive/v3/files/${result.id}?addParents=${folder}`,
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
            json: {
              fileId: result.id,
              name: options.meta.name,
              mimeType: options.meta.type,
            },
          };

          stepLogger('File has been uploaded processing is going on', 'info');
          return request(updation, (err, updateResponse, updateBody) => {
            if (err || result.error) {
              stepLogger(
                'Problem occurred when updating file please check if size available.',
                'error',
              );
              return this.wrap(
                new Error('Problem occurred when updating file please check if size available.'),
                null,
              );
            }

            stepLogger('File has been uploaded successfully.', 'success');
            return this.wrap(null, updateBody);
          });
        } catch (errParsingJSON) {
          return this.wrap(errParsingJSON, null);
        }
      }))
      .on('error', err => this.wrap(err, null))
      .on('end', () => {
        this.aborted();
      });
  }
  async getFileStream(meta) {
    return request.get(`https://www.googleapis.com/drive/v3/files/${meta.data.item.id}?alt=media`, {
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
    });
  }
}

module.exports = GoogleDrive;
