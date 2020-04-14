class Drive {
  constructor() {
    this.wrap = this.wrap.bind(this);
  }
  setAccessToken(accessToken) {
    this.accessToken = accessToken;
    this.killableStreams = [];
    return this;
  }

  getAccessToken() {
    return this.accessToken;
  }

  // prettier-ignore
  upload() { // eslint-disable-line
    throw new Error('this method is not implemented');
  }

  stop(reason) {
    this.killableStreams.forEach((stream) => {
      this.closeStream(stream, reason, { abort: true });
    });
  }

  // prettier-ignore
  closeStream(stream, reason = new Error('Task stopped unexpectedly/'), options = { abort: false }) { // eslint-disable-line
    try {
      if (!stream) return;
      if (stream.close) stream.close();
      if (stream.destroy) stream.destroy(reason);
      if (options.abort && stream.abort) {
        stream.abort();
      }
    } catch (err) {
      global.logger.error(err);
    }
  }
  addToKillableStream(...streams) {
    // if (!this.killableStreams) return false;
    return this.killableStreams.push(...streams);
  }

  setSourceStream(stream) {
    this._sourceStream = stream;
    return this;
  }

  /**
   * Stream
   */
  getSourceStream() {
    return this._sourceStream;
  }

  /**
   *
   * @param {SimpleStream} resource
   */
  setResource(resource) {
    this._resource = resource;
  }

  /**
   * @returns SimpleStream
   */
  getResource() {
    return this._resource;
  }

  wrap(error, success) {
    if (error) {
      return this._wrapCallback({
        message: error.message || error,
        usedBytes: this.getResource().getBytesTransferred(),
      });
    }
    const result = typeof success === 'string' ? { message: success } : success;
    return this._wrapCallback(null, {
      ...result,
      usedBytes: this.getResource().getBytesTransferred(),
    });
  }

  addWrapCallback(callback) {
    this._wrapCallback = callback;
  }

  aborted() {
    if (this.getSourceStream() && this.getSourceStream()._aborted) {
      this.wrap(new Error('Connection has been closed.'), {});
      return true;
    }
    return false;
  }

  getFileStream(data) {}
}
module.exports = Drive;
