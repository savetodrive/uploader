const { EventEmitter } = require('events');

class SimpleStream extends EventEmitter {
  constructor(stream) {
    super();
    if (!stream) {
      throw new Error('Please provide stream');
    }
    this.stream = stream;
    this._bytesTransferred = 0;
    this.listen();
  }

  _finished(data) {
    this.emit('finished', { ...data });
  }
  getBytesTransferred() {
    return this._bytesTransferred;
  }
  handleStreamEnd() {
    this._finished({ bytesTransferred: this._bytesTransferred, success: true });
  }
  handleStreamClosed() {}

  handleStreamFinish() {
    this._finished({ bytesTransferred: this._bytesTransferred });
  }

  handleStreamError() {
    this._finished({
      bytesTransferred: this._bytesTransferred,

      success: false,
    });
  }
  handleDataFlow(chunk) {
    this._bytesTransferred += chunk.length;
  }
  throttle() {}

  get() {
    return this.stream;
  }
  listen() {
    this.stream.on('data', this.handleDataFlow.bind(this));
    this.stream.on('close', this.handleStreamClosed.bind(this));
    this.stream.on('finish', this.handleStreamFinish.bind(this));
    this.stream.on('error', this.handleStreamError.bind(this));
    this.stream.on('end', this.handleStreamEnd.bind(this));
    return this;
  }
}

module.exports = SimpleStream;
