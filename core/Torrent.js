const WebTorrent = require('webtorrent');

const dummyTorrent = {
  name: 'www.YTS.AM.jpg',
  path: 'Parmanu The Story Of Pokhran (2018) [BluRay] [720p] [YTS.AM]/www.YTS.AM.jpg',
  torrent: {
    type: 'file',
    identifier:
      'https://std-space.nyc3.digitaloceanspaces.com/d5991827-d126-401a-95b1-25b92a7dfb98.torrent',
  },
  size: 58132,
  id: 'Parmanu The Story Of Pokhran (2018) [BluRay] [720p] [YTS.AM]/www.YTS.AM.jpg',
  format: 'file',
  type: '.jpg',
};
class Torrent {
  static resolve(payload) {
    return new Promise((resolve, reject) => {
      const client = new WebTorrent();
      client.add(payload.torrent.identifier, (torrent) => {
        if (!torrent) {
          return reject(new Error('Unable to extract torrent.'));
        }
        const file = torrent.files.find(item => item.path === payload.path);
        if (!file) {
          return reject(new Error('Sorry! we are unable to file requested from torrent.'));
        }
        return resolve(file.createReadStream());
      });
    });
  }
}
module.exports = Torrent;
