const request = require('request');
const path = require('path');
const mime = require('mime');
const through = require('through');
const prettysize = require('prettysize');
const Dbx = require('dropbox');
const autobind = require('auto-bind');
const Progress = require('../Progress');
const Drive = require('./Drive');
const HttpClient = require('../HttpClient');

const UPLOAD_SESSION_START = 'https://content.dropboxapi.com/2/files/upload_session/start';
const UPLOAD_SESSION_APPEND = 'https://content.dropboxapi.com/2/files/upload_session/append_v2';
const UPLOAD_SESSION_FINISH = 'https://content.dropboxapi.com/2/files/upload_session/finish';
const FILE_META_DATA = 'https://api.dropboxapi.com/2/files/get_metadata';
const TEMP_FILE_URL = 'https://api.dropboxapi.com/2/files/get_temporary_link';

class DropBox extends Drive {
  constructor() {
    super();
    autobind(this);
    this.sessionId = null;
    this.transferred = 0;
    this.chunkCounter = 0;
    this.breakPoint = 52428800;
    this.currentStream = null;
    this.stream = null;
    this.completed = false;
    this.metaData = {};
    this.progressHandler = null;
    this.stepsLog = null;
  }

  getFileMeta(fileId) {
    return new Promise((resolve, reject) => {
      request.post(
        {
          url: FILE_META_DATA,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          json: {
            path: fileId,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false,
          },
        },
        (err, h, b) => {
          if (err || h.statusCode > 299) {
            return reject(err || new Error());
          }
          return resolve(b);
        },
      );
    });
  }
  getStream({ offset }) {
    const headers = {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${this.getAccessToken()}`,
      'Dropbox-API-Arg': JSON.stringify({
        cursor: {
          session_id: this.sessionId,
          offset,
        },
        close: false,
      }),
    };
    return through().pipe(request(
      {
        method: 'POST',
        url: UPLOAD_SESSION_APPEND,
        headers,
      },
      (error, httpResponse) => {
        if (error || httpResponse.statusCode !== 200) {
          this.stepsLog('Unable to complete upload.', 'danger');
          return false;
        }

        this.stream.resume();
        if (!this.completed) {
          return false;
        }

        if (!this.destinationPath) {
          this.finishCall();
        } else {
          this.getFileMeta(this.destinationPath)
            .then(({ path_lower }) => {
              this.finishCall(path_lower);
            })
            .catch(() => {
              // We will commit file any way if not in specifed folder then in root
              this.finishCall();
            });
        }
        return true;
      },
    ));
  }

  finishCall(destinationPath = null) {
    this.stepsLog('Finished uploading, processing file', 'info');
    request(
      {
        method: 'POST',
        url: UPLOAD_SESSION_FINISH,
        headers: {
          Authorization: `Bearer ${this.getAccessToken()}`,
          'Dropbox-API-Arg': JSON.stringify({
            cursor: {
              session_id: this.sessionId,
              offset: this.transferred,
            },
            commit: {
              path: destinationPath
                ? `${destinationPath}/${this.metaData.name}`
                : `/${this.metaData.name}`,
              mode: 'add',
              autorename: true,
              mute: false,
            },
          }),
          'Content-Type': 'application/octet-stream',
        },
      },
      (err, http) => {
        if (err || http.statusCode !== 200) {
          return this.wrap(new Error('Unable to finish upload successfully.'), null);
        }
        this.stepsLog('File has been uploaded successfully.', 'success');
        this.wrap(null, this.metaData);
        this.createStream = null;
        this.stream = null;
        return true;
      },
    );
  }

  upload(context, progressLogger, stepLogger) {
    this.stepsLog = stepLogger;
    this.progressHandler = progressLogger;
    this.metaData = context.meta;
    this.destinationPath = context.destinationMeta
      ? context.destinationMeta.data.activeFolder.id
      : null;
    this.destinationPath = this.destinationPath === 'root' ? null : this.destinationPath;
    this.startUpload(context, progressLogger, stepLogger);
  }

  startUpload(context, progressLogger, stepLogger) {
    request(
      {
        url: UPLOAD_SESSION_START,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': '{ "close": false}',
          'Content-Type': 'application/octet-stream',
        },
      },
      (error, http, response) => {
        if (error || http.statusCode !== 200) {
          const err = new Error(
            'Unable to start uploading process, Please check if you are authenticated.',
            'error',
          );
          stepLogger(err.message, 'error');
          return this.wrap(err, null);
        }
        stepLogger('Dropbox upload session has been started.', 'info');

        const data = JSON.parse(response);
        this.sessionId = data.session_id;
        this.currentStream = this.getStream({ offset: 0 });
        const pg = new Progress(context.meta.size);
        this.stream = this.getSourceStream();
        this.stream.on('error', (streamError) => {
          this.wrap(streamError.message);
          this.closeStream(this.stream);
        });
        this.stream.on('data', (chunk) => {
          if (this.chunkCounter >= this.breakPoint) {
            this.chunkCounter = 0;
            this.stream.pause();
            this.currentStream.end();
            this.currentStream = this.getStream({ offset: this.transferred });
          }
          this.currentStream.write(chunk);
          this.chunkCounter += chunk.length;
          this.transferred += chunk.length;
          pg.flow(
            chunk,
            ({ raw, pretty }) => {
              progressLogger({ progress: pretty, fileId: context.meta.uuid });
            },
          );
        });

        this.stream.on('end', () => {
          if (!this.aborted()) {
            this.chunkCounter = 0;
            this.currentStream.end();
            this.completed = true;
            stepLogger('Transferring file has been finished.', 'info');
          }
        });
        return true;
      },
    );
  }

  getAccessToken() {
    return this.accessToken;
  }

  getTemporaryLink(fileId) {
    const http = HttpClient.auth(this.getAccessToken());
    return http.post(
      TEMP_FILE_URL,
      { path: fileId },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );
  }
  async getFileStream(meta) {
    try {
      const fileId = meta.data.item.id;
      const tempUrlData = await this.getTemporaryLink(fileId);
      return request.get(tempUrlData.data.link);
    } catch (err) {
      return err;
    }
  }
}

module.exports = DropBox;
