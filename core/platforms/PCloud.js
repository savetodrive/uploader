const request = require('request');
const Progress = require('../Progress');
const Drive = require('./Drive');
const autobind = require('auto-bind');
const { decrypt } = require('../utils');

class PCloud extends Drive {
  constructor() {
    super();
    autobind(this);
  }
  upload(context, progressLogger, stepLogger) {
    const stream = this.getSourceStream();
    const pg = new Progress(context.meta.size);
    let folderid = 0;
    if (context.destinationMeta) {
      const file =
        context.destinationMeta.data.activeFolder.id === 'root'
          ? { id: 0 }
          : JSON.parse(decrypt(context.destinationMeta.data.activeFolder.id));
      folderid = file.id;
    }
    console.log(folderid, context.meta);
    const uploadOptions = {
      url: 'https://api.pcloud.com/uploadfile',
      headers: {
        Authorization: `Bearer ${this.getAccessToken()}`,
      },
      formData: {
        folderid,
        filename: context.meta.name,
        file: stream,
        renameifexists: 'true',
      },
    };
    stepLogger('pCloud upload session has been started.', 'info');
    stream.on('data', (chunk) => {
      pg.flow(
        chunk,
        ({ raw, pretty }) => {
          progressLogger({ progress: pretty, fileId: context.meta.uuid });
        },
      );
    });
    stream
      .on('error', (streamError) => {
        this.wrap(streamError.message);
        this.closeStream(stream);
      })
      .on('end', () => {
        this.aborted();
      });
    request.post(uploadOptions, (error, status, body) => {
      if (error) {
        stepLogger('Unable to complete upload.', 'error');
        return this.wrap(error);
      }

      stepLogger('File has been uploaded successfully.', 'success');
      this.wrap(null, JSON.parse(body));
      return true;
    });
  }

  getFileStream(meta) {
    const file = JSON.parse(decrypt(meta.data.item.id));
    return new Promise((resolve, reject) => {
      request(
        {
          url: 'https://api.pcloud.com/getfilelink',
          qs: {
            fileid: file.id,
          },
          headers: {
            Authorization: `Bearer ${this.getAccessToken()}`,
          },
        },
        (err, http, body) => {
          if (err || http.statusCode > 299) {
            return reject(err);
          }
          const result = JSON.parse(body);
          const url = encodeURI(`https://${result.hosts.pop()}${result.path}`);
          return resolve(request.get(url));
        },
      );
    });
  }
}
module.exports = PCloud;
