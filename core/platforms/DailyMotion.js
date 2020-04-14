const request = require('request');
const autobind = require('auto-bind');
const Progress = require('../Progress');
const Drive = require('./Drive');

class DailyMotion extends Drive {
  constructor() {
    super();
    autobind(this);
  }
  upload(context, progressLogger, stepLogger) {
    const UPLOAD_SESSION_URL = 'https://api.dailymotion.com/file/upload';
    stepLogger('Media from url has been found, Uploading to Dailymotion.', 'info');
    request(
      UPLOAD_SESSION_URL,
      {
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`,
        },
      },
      (err, response, body) => {
        if (err || response.statusCode > 299) {
          return this.wrap(err);
        }

        try {
          const pg = new Progress(context.meta.size);
          const uploadUrl = JSON.parse(body).upload_url;
          const stream = this.getSourceStream();
          stream
            .on('data', (chunk) => {
              pg.flow(
                chunk,
                ({ raw, pretty }) => {
                  progressLogger({ progress: pretty, fileId: context.meta.uuid });
                },
              );
            })
            .on('error', (streamError) => {
              this.wrap(streamError.message);
              this.closeStream(stream);
            });
          stream.on('end', () => {
            this.aborted();
          });
          return request.post(
            uploadUrl,
            {
              formData: {
                stream,
              },
            },
            (uploadError, uploadResponse, uploadBody) => {
              if (uploadError) {
                stepLogger(uploadError.message, 'error');
                return this.wrap(uploadError, null);
              }

              if (uploadResponse.statusCode > 399) {
                stepLogger('Error uploading media, Check size or Authenticate again.', 'error');
                return this.wrap(
                  new Error('Error uploading media, Check size or Authenticate again.'),
                  null,
                );
              }
              const parsedJSON = JSON.parse(uploadBody);
              return request(
                'https://api.dailymotion.com/videos',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${this.getAccessToken()}`,
                  },
                  form: {
                    url: parsedJSON.url,
                    title: context.meta.name,
                    tags: '',
                    channel: context.authProfile.name,
                    published: true,
                  },
                },
                (publishError, publishResponse, publishBody) => {
                  if (publishError) {
                    stepLogger(publishError.message, 'error');
                    return this.wrap(publishError, null);
                  }
                  const parsedPublihed = JSON.parse(publishBody);
                  if (publishResponse.statusCode > 399 || parsedPublihed.error) {
                    stepLogger('Some error occured while publishing video.', 'error');
                    return this.wrap(new Error('Some error occured while publishing video.'), null);
                  }
                  stepLogger('Media has been uploaded successfully.', 'success');
                  return this.wrap(null, publishBody);
                },
              );
            },
          );
        } catch (error) {
          return this.wrap(error);
        }
      },
    );
  }
}

module.exports = DailyMotion;
