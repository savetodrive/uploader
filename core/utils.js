const redis = require('redis');
const crypto = require('crypto');

exports.createRedisClient = ({ host, port, password }) =>
  () => redis.createClient({
    host,
    port,
    password,
  });

/*
  * Encrypt
  * */
exports.encrypt = function (plain) {
  const cipher = crypto.createCipher('aes256', process.env.ENCRYPTION_SECRET);
  let cipherText = cipher.update(plain, 'utf8', 'base64');
  cipherText += cipher.final('base64');
  return cipherText;
};

exports.decrypt = function (encrypted) {
  const decipher = crypto.createDecipher('aes256', process.env.ENCRYPTION_SECRET);
  let res = decipher.update(encrypted, 'base64', 'utf8');
  res += decipher.final('utf8');
  return res;
};

exports.quitRedis = redisConnection =>
  new Promise((resolve, reject) => {
    redisConnection.quit();
    redisConnection.on('end', resolve);
    redisConnection.on('error', reject);
  });

