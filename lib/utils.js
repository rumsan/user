var crypto = require('crypto');

var SALT_LENGTH = 64; // Length of the salt, in bytes
var TOKEN_LENGTH = 64;
var HASH_LENGTH = 64; // Length of the hash, in bytes
var HASH_ITERATIONS = 1000; // Number of pbkdf2 iterations

function generateSalt() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(SALT_LENGTH, (err, salt) => {
      if(err) reject(err);
      resolve(salt);
    })
  });
}

function generateToken() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(TOKEN_LENGTH, (err, token) => {
      if(err) reject(err);
      resolve(token);
    })
  });
}

function hash(data, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(data, salt, HASH_ITERATIONS, HASH_LENGTH, 'sha1', (err, hash) => {
      if (err) {
        reject(err);
      }
      resolve({
        salt: salt,
        hash: hash
      });
    });
  });
}

function saltAndHash(data) {
  return generateSalt().then((salt) => {
    return hash(data, salt);
  });
}

module.exports = { generateSalt, generateToken, hash, saltAndHash };
