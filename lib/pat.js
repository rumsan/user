/* eslint-disable */
//TODO: NEED TO fix for ESLINT

const crypto = require('crypto');
const { Secure } = require('./utils');

class PAT {
  constructor({ models, messenger, TokenManager }) {
    this.models = models;
    this.messenger = messenger;
    this.TokenManager = TokenManager;
  }

  async create({
    user_id, name, scopes, expiry_date,
  }) {
    const key = `RS${
      crypto
        .randomBytes(10)
        .toString('hex')
        .toUpperCase()}`;
    const secret = crypto.randomBytes(48).toString('hex');
    const secretHash = await Secure.saltAndHash(secret);

    const pat = new this.models.PATModel({
      user_id,
      name,
      key,
      secretHash: secretHash.hash.toString('base64'),
      salt: secretHash.salt.toString('base64'),
      scopes: scopes || [],
      expiry_date: expiry_date || null,
    });
    await pat.save();
    return {
      user_id, name, key, secret, scopes, expiry_date,
    };
  }

  async getToken({ key, secret, tokenData = {} }) {
    const patData = await this.validate(key, secret);
    const user = await this.models.UserModel.findOne(
      { _id: patData.user_id, is_active: true },
      { password: 0 },
    );
    return this.generateToken(user, tokenData);
  }

  async generateToken(user, tokenData = {}) {
    const jwtDuration = 1200000; // 20 minutes expiry
    let data = {};
    if (typeof tokenData === 'function') data = await tokenData(user);
    else data = tokenData;
    Object.assign(data, {
      user_id: user._id,
      name: user.name,
    });
    return this.TokenManager.generate(data, jwtDuration);
  }

  async validate(key, secret) {
    const pat = await this.models.PATModel.findOne({
      key,
      $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }],
    });
    if (!pat) return false;
    const secretHash = await Secure.hash(secret, Buffer.from(pat.salt, 'base64'));
    if (secretHash.hash.toString('base64') !== pat.secretHash) return false;

    return {
      id: pat._id,
      user_id: pat.user_id,
      name: pat.name,
      key: pat.key,
      scopes: pat.scopes,
      expiry_date: pat.expiry_date,
    };
  }

  list(userId) {
    return this.models.PATModel.find({ userId }, { secretHash: 0, salt: 0 });
  }

  remove(key) {
    return this.models.PATModel.findOneAndDelete({ key });
  }
}

module.exports = PAT;
