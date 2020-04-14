const request = require('request');

const METHODS = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
};

class SimpleRequest {
  constructor(url, options = {}) {
    if (!url) {
      throw new Error('url is required');
    }
    this.url = url;
    this.options = {
      method: METHODS.GET,
      headers: {},
      ...options,
    };
  }

  createRequest() {
    return request[this.options.method.toLowerCase()](this.url, this.options);
  }
  get() {
    this.setMethod(METHODS.GET);
    return this.createRequest();
  }
  post() {
    this.setMethod(METHODS.POST);
    return this.createRequest();
  }
  patch() {
    this.setMethod(METHODS.PATCH);
    return this.createRequest();
  }
  put() {
    this.setMethod(METHODS.PUT);
    return this.createRequest();
  }
  setAuth(username, password) {
    this.options.auth = {
      user: username,
      pass: password,
    };
  }

  setMethod(method) {
    this.options.method = method;
  }
  setTimeout(timeout) {
    this.options.timeout = timeout;
  }

  /**
   * when passed an object or a querystring, this sets body to a querystring representation of value,
   *  and adds Content-type: application/x-www-form-urlencoded header. When passed no options,
   *  a FormData instance is returned (and is piped to request). See "Forms" section above.
   */
  setFormData(formData) {
    this.options.formData = formData;
  }

  /**
   *  entity body for PATCH, POST and PUT requests. Must be a Buffer, String or ReadStream.
   *  If json is true, then body must be a JSON-serializable object.
   */
  setBody(body) {
    this.options.body = body;
  }

  /**
   *
   *   when passed an object or a querystring, this sets body to a querystring representation of value,
   * and adds Content-type: application/x-www-form-urlencoded header. When passed no options,
   * a FormData instance is returned (and is piped to request). See "Forms" section above.
   */
  setForm(form) {
    this.options.form = form;
  }

  /**
   *  sets body to JSON representation of value and adds Content-type: application/json header.
   *  Additionally, parses the response body as JSON.
   * @param  json
   */
  setJSON(json) {
    this.options.json = json;
  }

  followAllRedirects() {
    this.options.followAllRedirects = true;
  }

  addHeader(key, value) {
    this.options.headers[key] = value;
  }
}

module.exports = SimpleRequest;