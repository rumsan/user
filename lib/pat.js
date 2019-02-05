var crypto = require("crypto");
const { Secure } = require("./utils");
const { ERR } = require("./error");

class PAT {
  constructor({ models, messenger }) {
    this.models = models;
    this.messenger = messenger;
  }

  async create({ user_id, name, scopes, expiry_date }) {
    let key =
      "RS" +
      crypto
        .randomBytes(10)
        .toString("hex")
        .toUpperCase();
    let secret = crypto.randomBytes(48).toString("hex");
    let secretHash = await Secure.saltAndHash(secret);

    let pat = new this.models.PATModel({
      user_id,
      name,
      key,
      secretHash: secretHash.hash.toString("base64"),
      salt: secretHash.salt.toString("base64"),
      scopes: scopes || [],
      expiry_date: expiry_date || null
    });
    await pat.save();
    return { user_id, name, key, secret, scopes, expiry_date };
  }

  async validate(key, secret) {
    let pat = await this.models.PATModel.findOne({
      key,
      expiry_date: { $gt: new Date() }
    });
    if (!pat) return false;
    let secretHash = await Secure.hash(secret, Buffer.from(pat.salt, "base64"));
    if (secretHash.hash.toString("base64") !== pat.secretHash) return false;
    else {
      return {
        id: pat._id,
        user_id: pat.user_id,
        name: pat.name,
        key: pat.key,
        scopes: pat.scopes,
        expiry_date: pat.expiry_date
      };
    }
  }

  list(user_id) {
    return this.models.PATModel.find({ user_id }, { secretHash: 0, salt: 0 });
  }

  remove(key) {
    return this.models.PATModel.findOneAndDelete({ key });
  }
}

module.exports = PAT;
