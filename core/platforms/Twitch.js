const progressStream = require('../StreamProgress');
const request = require('request');
const prettysize = require('prettysize');
const prettyTime = require('pretty-time');

// Bytes need to broken
class Twitch {
  setAccessToken(accessToken) {
    this.accessToken = accessToken;
    return this;
  }

  getAccessToken() {
    return this.accessToken;
  }

  upload(context, progressLogger, stepLogger, cb) {
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
          fileId: context.meta.uuid,
        });
      },
    );
    progressStreamable.setLength(context.headers['content-length']);
    // Generate Url for upload
    request.post(
      'https://api.twitch.tv/kraken/videos',
      {
        headers: {
          Authorization: `OAuth ${this.getAccessToken()}`,
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          Accept: 'application/vnd.twitchtv.v5+json',
        },
        qs: {
          channel_id: context.authProfile.channel_id,
          title: context.meta.name,
          viewable: 'private',
        },
      },
      (err, response, body) => {
        if (err) {
          stepLogger('Unable to upload');
          return cb(err);
        }

        if (response.statusCode > 299) {
          global.logger.error(body);
          return cb(new Error('Unable to upload.'));
        }

        const parsedBody = JSON.parse(body);
        stepLogger('Media from url has been found, Uploading to Twitch.', 'info');
        // Upload File
        return request
          .get({ url: context.url })
          .pipe(progressStreamable)
          .pipe(request.put(
            `https://uploads.twitch.tv/upload/${parsedBody.video._id}`,
            {
              headers: {
                Authorization: `OAuth ${this.getAccessToken()}`,
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Content-Length': context.headers['content-length'],
              },
              qs: {
                upload_token: parsedBody.upload.token,
              },
            },
            (uploadError, uploadResponse, uploadBody) => {
              if (uploadError) {
                stepLogger(uploadError.message);
                return cb(uploadError);
              }
              if (uploadResponse.statusCode > 299) {
                global.logger.error(uploadBody);
                stepLogger('Unable to upload');
                return cb(new Error('Unable to upload.'));
              }
              // Uploading video is done call complete API
              return request.post(
                `https://uploads.twitch.tv/upload/${parsedBody.video._id}/complete`,
                {
                  headers: {
                    Authorization: `OAuth ${this.getAccessToken()}`,
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                  },
                  qs: {
                    upload_token: parsedBody.upload.token,
                  },
                },
                (completeError, completeResponse, completeBody) => {
                  console.log(completeError, completeBody);
                  if (completeError) {
                    stepLogger('Unable to upload');
                    return cb(completeError);
                  }
                  if (completeResponse.statusCode > 299) {
                    global.logger.error(completeBody);
                    stepLogger('Unable to upload');
                    return cb(new Error('Unable to upload.'));
                  }
                  stepLogger('Media has been uploaded successfully.', 'success');
                  return cb(null, completeBody);
                },
              );
            },
          ));
      },
    );
  }
}
module.exports = Twitch;
