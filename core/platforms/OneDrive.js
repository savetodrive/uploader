const credit = require('../../../../../config/drives');

class OneDrive {
  constructor() {
    const { client_id, scopes, redirect_uri } = credit.drives.oneDrive;
    this.authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${client_id}&scope=${scopes.join(' ')}&response_type=code&redirect_uri=${redirect_uri}`;
  }

  connect() {}

  getAuthUrl() {
    return this.authUrl;
  }
}

module.exports = OneDrive;
