const GoogleDrive = require('./platforms/GoogleDrive');
const DropBox = require('./platforms/DropBox');
const Box = require('./platforms/Box');
const PCloud = require('./platforms/PCloud');
const Youtube = require('./platforms/Youtube');
const YandexDisk = require('./platforms/YandexDisk');
const DailyMotion = require('./platforms/DailyMotion');
const Twitch = require('./platforms/Twitch');
const Noop = require('./platforms/Noop');

class Drive {
  constructor(service) {
    if (service) {
      this.setService(service);
    }
  }

  setService(service) {
    const Service = Drive.getServiceMappedToDrive()[service];
    this.service = new Service();
    return this;
  }

  static getServiceMappedToDrive() {
    return {
      'google-drive': GoogleDrive,
      dropbox: DropBox,
      box: Box,
      pcloud: PCloud,
      youtube: Youtube,
      'yandex-disk': YandexDisk,
      dailymotion: DailyMotion,
      twitch: Twitch,
      noop: Noop,
    };
  }

  static serviceExists(service) {
    return Drive.getServiceMappedToDrive().hasOwnProperty(service);
  }

  setAccessToken(response) {
    return this.service.setAccessToken(response);
  }

  getAccessToken() {
    return this.service.getAccessToken();
  }

  upload(options, progressLogger, stepLogger, cb) {
    this.service.upload(options, progressLogger, stepLogger, cb);
  }

  createResource(stream) {
    this.service.setResource(stream);
    this.service.setSourceStream(stream.get());
    this.addToKillableStream(this.service.getSourceStream());
  }

  addToKillableStream(stream) {
    this.service.addToKillableStream(stream);
  }

  addWrapCallback(callback) {
    this.service.addWrapCallback(callback);
  }
  getFileStream(data) {
    return this.service.getFileStream(data);
  }
}

module.exports = Drive;
