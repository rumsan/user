/** @const */
const _ = require("lodash");
/** @const */
const fs = require("fs");
/** @const */
const buildModels = require("./models");
/** @const */
const utils = require("./utils");
/** @const */
const { Error, ERR } = require("./error");
/** @const */
const { Secure, NameParser } = utils;
/** @const */
const pwd = require("./pwd");
/** @const */
const pat = require("./pat");
/** @const */
const tokenExpiration = 24 * 7 * 1000 * 60 * 60;
/** @const */
const tokenExpireBalancer = 3 * 1000;

var AuthModel, CommModel, UserModel, PATModel, Mongoose;

const stringToObjectId = id => {
  return Mongoose.Types.ObjectId(id);
};

const addCommsWithoutUserIdCheck = (user_id, comms) => {
  if (!Array.isArray(comms)) comms = [comms];
  let arrComm = _.cloneDeep(comms);

  let existingComms;

  return new Promise((resolve, reject) => {
    CommModel.find({ user_id })
      .then(r => {
        existingComms = r;
        let newComms = _.differenceBy(arrComm, existingComms, "address");
        newComms.map(obj => {
          obj.user_id = user_id;
          return obj;
        });
        return CommModel.insertMany(newComms);
      })
      .then(r => {
        let existingCommIds = existingComms.map(c => c._id);
        let newCommIds = r.map(c => c._id);
        return _.union(existingCommIds, newCommIds);
      })
      .then(commIds => {
        return UserModel.findByIdAndUpdate(
          user_id,
          { $set: { comms: commIds } },
          { new: true, fields: { password: 0 } }
        );
      })
      .then(r => resolve(r))
      .catch(e => reject(e));
  });
};

class User {
  /**
   * @mongoose {object} Send reference to mongoose from your application.
   * @messenger {object} Send reference to fully configured nodemailer reference.
   * @appSecret {string} Your application secret. Must be 12 characters
   * @modelConfig {object} config to change collection name, model name and extend user schema
   * @options {object} These are the valid options
   * @return {number} result of the sum value.
   */
  constructor({ mongoose, messenger, appSecret, modelConfig, jwtDuration }) {
    if (!mongoose) throw ERR.MONGOOSE;
    if (!appSecret) throw ERR.APP_SECRET;
    if (appSecret.length != 32) throw ERR.APP_SECRET32;

    this.models = buildModels({ mongoose, modelConfig });
    this.TokenManager = new utils.Token({ appSecret });

    AuthModel = this.models.AuthModel;
    CommModel = this.models.CommModel;
    UserModel = this.models.UserModel;
    PATModel = this.models.PATModel;

    Mongoose = mongoose;

    //activate password manager
    this.PasswordManager = new pwd({ models: this.models, messenger });
    this.PATManager = new pat({ models: this.models, TokenManager: this.TokenManager, messenger });

    this.jwtDuration = jwtDuration || 1000 * 60 * 20;
    this.messenger = messenger || { disable: true };
  }

  addAuth({ user_id, username, type }) {
    return new Promise((resolve, reject) => {
      AuthModel.findOne({ username })
        .then(a => {
          if (a) reject(ERR.AUTH_EXISTS);
          let record = new AuthModel({
            user_id: stringToObjectId(user_id),
            username,
            type
          });
          return record.save();
        })
        .then(d => {
          resolve(d);
        })
        .catch(e => reject(e));
    });
  }

  getAuthByUsername(username) {
    return AuthModel.findOne({ username });
  }

  addComms(user_id, comms) {
    return new Promise((resolve, reject) => {
      UserModel.findOne({ _id: user_id, is_active: true })
        .then(u => {
          if (!u) reject(ERR.USER_NOEXISTS);
          return addCommsWithoutUserIdCheck(user_id, comms);
        })
        .then(d => resolve(d))
        .catch(e => reject(e));
    });
  }

  addRoles({ user_id, roles }) {
    roles = roles || [];
    if (typeof roles == "string") roles = roles.split(",");
    return UserModel.findByIdAndUpdate(user_id, { $addToSet: { roles } }, { new: 1 }).select(
      "-password"
    );
  }

  removeRole({ user_id, role }) {
    return UserModel.findByIdAndUpdate(
      user_id,
      { $pull: { roles: role } },
      { password: 0, new: 1 }
    ).select("-password");
  }

  async authenticate({ username, password, tokenData, jwtDuration, loginBy = "email" }) {
    /*
      tokenData (object): Data to be added in token. Please do not add too much data.
      jwtDuration (Number): Duration JWT Token valid for.
    */
    let user = await this.verifyLogin(username, password, { loginBy });
    let tkn = await this.generateToken(user, tokenData, jwtDuration);
    user.token = tkn;
    return user;
  }

  async authExists(username, options = {}) {
    let auth = await AuthModel.findOne({ username });
    return auth != null;
    // if (auth) {
    //   if (options.ignoreAddress == auth.address) return false;
    //   return true;
    // } else return false;
  }

  changeStatus(id, status) {
    return this.models.UserModel.findByIdAndUpdate(
      { _id: id },
      { is_active: status },
      { new: true }
    );
  }

  remove(user_id) {
    return new Promise((resolve, reject) => {
      AuthModel.deleteMany({ user_id })
        .then(u => CommModel.deleteMany({ user_id }))
        .then(u => UserModel.findOneAndDelete({ _id: user_id }))
        .then(u => resolve(true))
        .catch(e => reject(e));
    });
  }

  create(payload, options = {}) {
    var me = this;
    /*
        payload: User object. Must send either email or phone.
        options:
            comms_verified (Boolean): Flag is_verified to true in comms record
        */
    payload = Object.assign({}, payload);
    if (!payload.name) throw ERR.NAME_REQ;
    if (typeof payload.name == "string") payload.name = NameParser.parse(payload.name);

    payload.auth = payload.auth || {};
    if (!payload.auth.username) throw ERR.AUTH_REQ;

    payload.password = payload.password || Math.floor(100000 + Math.random() * 900000).toString();

    var comms = payload.comms || [];
    if (payload.email) {
      comms.push({
        type: "email",
        is_primary: true,
        address: payload.email,
        is_verified: options.comms_verified || false
      });
    }
    if (payload.phone) {
      comms.push({
        type: "phone",
        is_primary: true,
        address: payload.phone,
        is_verified: options.comms_verified || false
      });
    }

    return new Promise((resolve, reject) => {
      me.authExists(payload.auth.username)
        .then(exists => {
          if (exists) throw ERR.USERNAME_EXISTS;
        })
        .then(() => Secure.saltAndHash(payload.password))
        .then(pwdHash => {
          const user_record = new UserModel(
            Object.assign(payload, {
              password: {
                hash: pwdHash.hash.toString("base64"),
                salt: pwdHash.salt.toString("base64")
              }
            })
          );
          user_record
            .save()
            .then(user =>
              me.addAuth(
                Object.assign({}, payload.auth, {
                  user_id: user_record._id,
                  social: payload.social
                })
              )
            )
            .then(auth => me.addComms(user_record._id, comms))
            .then(() => me.getById(user_record._id))
            .then(user => resolve(user))
            .catch(err => {
              me.remove(user_record._id);
              reject(err);
            });
        })
        .catch(err => reject(err));
    });
  }

  createUsingEmail(payload, options = {}) {
    /*
        Options:
            notify (Boolean): Send notifications through email.
        */
    payload = Object.assign({}, payload);
    if (!payload.email) throw ERR.EMAIL_REQ;

    payload.auth = { username: payload.email, type: "email" };

    return new Promise((resolve, reject) => {
      this.create(payload, options)
        .then(user => {
          if (options.notify) {
            const emailData = Object.assign({ rawPassword: payload.password }, user);
            this.sendMessage(payload.email, emailData, "signup");
          }

          resolve(user);
        })
        .catch(err => reject(err));
    });
  }

  createUsingPhone(payload, options = {}) {
    /*
            notify (Boolean): Send notifications through phone.
        */
    payload = Object.assign({}, payload);
    if (!payload.phone) throw ERR.PHONE_REQ;

    payload.auth = { username: payload.phone, type: "phone" };

    return new Promise((resolve, reject) => {
      this.create(payload, options)
        .then(user => {
          if (options.notify) {
            //ToDo: code for sending phone confirmation
          }

          resolve(user);
        })
        .catch(err => reject(err));
    });
  }

  async generateToken(user, tokenData = {}, jwtDuration) {
    let data = {};
    if (typeof tokenData === "function") data = await tokenData(user);
    else data = tokenData;
    Object.assign(data, {
      user_id: user.id,
      name_first: user.name.first,
      name: user.name.full
    });
    return this.TokenManager.generate(data, jwtDuration || this.jwtDuration);
  }

  getById(user_id, options = {}) {
    /*
        Options:
            returnPwd (Boolean): Return password hash or not.
        */
    let showFields = { password: 0 };
    if (options.returnPwd) showFields = {};
    options.returnPwd = options.returnPwd || false;
    return UserModel.findOne({ _id: user_id, is_active: true }, showFields).populate("comms");
  }

  getByUsername(username, type = "email", options = {}) {
    /*
        Options:
            returnPwd (Boolean): Return password hash or not.
        */
    return new Promise((resolve, reject) => {
      AuthModel.findOne({ username, type })
        .then(auth => {
          if (!auth) return null;
          return this.getById(auth.user_id, options);
        })
        .then(d => resolve(d))
        .catch(e => reject(e));
    });
  }

  getLean(userId) {
    return this.models.UserModel.findById(userId).lean();
  }

  getMe(token, options) {
    return new Promise((resolve, reject) => {
      this.TokenManager.validate(token)
        .then(token_data => this.getById(token_data.data.user_id, options))
        .then(data => resolve(data))
        .catch(err => reject(err));
    });
  }

  async registerByExternal({ service, service_id, extras = {}, options = {} }) {
    let origExtras = Object.assign({}, extras);
    let createUsing = options.createUsing || "email";
    let user = null;
    if (createUsing == "email") {
      if (!extras.email) throw ERR.EMAIL_REQ;
      user = await this.createUsingEmail(extras);
    } else if (createUsing == "phone") {
      if (!extras.phone) throw ERR.PHONE_REQ;
      user = await this.createUsingPhone(extras);
    }

    if (!user) throw ERR.USER_NOEXISTS;
    let auth = new AuthModel({
      user_id: user._id,
      type: service,
      username: service_id,
      extras: origExtras
    });
    await auth.save();
    return user;
  }

  async authenticateExternal({
    service,
    service_id,
    tokenData,
    jwtDuration,
    extras,
    options = {}
  }) {
    options.registerNewUser = options.registerNewUser || true;
    let user = null;
    let auth = await AuthModel.findOne({
      type: service,
      username: service_id
    });

    if (!auth) {
      //TODO need to revisit this. Little dangerous like this. need to verify existing email or phone before logging in.
      if (extras.phone) {
        auth = await AuthModel.findOne({
          type: "phone",
          username: extras.phone
        });
      } else if (extras.email) {
        auth = await AuthModel.findOne({
          type: "email",
          username: extras.email
        });
      }

      if (auth) {
        let newAuth = new AuthModel({
          user_id: auth.user_id,
          type: service,
          username: service_id,
          extras
        });
        await newAuth.save();
      } else {
        if (options.registerNewUser)
          user = await this.registerByExternal({ service, service_id, extras, options });
        else throw new Error("Please contact admin to give you access to the system first.");
      }
    }

    if (!user) user = await this.getById(auth.user_id);
    let tkn = await this.generateToken(user, tokenData, jwtDuration);
    user.token = tkn;
    return user;
  }

  async authenticatePAT({ key, secret }) {
    let pat = await this.PATManager.validate(key, secret);
    if (!pat) throw new Error("Unauthorized Personal Access Token.");
    return UserModel.findOne({ _id: pat.user_id, is_active: true }, { password: 0 }).lean();
  }

  restore(id) {
    return this.changeStatus(id, true);
  }

  suspend(id) {
    return this.changeStatus(id, false);
  }

  async updateName(user_id, name) {
    if (!name) throw ERR.NAME_REQ;
    if (typeof name == "string") name = NameParser.parse(name);
    let user = await UserModel.findByIdAndUpdate(
      user_id,
      { name },
      { new: true, fields: { password: 0 } }
    );
    return user.name;
  }

  async updatePrimaryPhone(user_id, phone) {
    let comm = await CommModel.findOneAndUpdate(
      { user_id: stringToObjectId(user_id), type: "phone", is_primary: true },
      { address: phone },
      { new: true }
    );
    let auth = await AuthModel.findOneAndUpdate(
      { user_id: stringToObjectId(user_id), type: "phone" },
      { username: phone },
      { new: true }
    );
    return { comm, auth };
  }
  async updatePrimaryEmail(user_id, email) {
    let comm = await CommModel.findOneAndUpdate(
      { user_id: stringToObjectId(user_id), type: "email", is_primary: true },
      { address: email },
      { new: true }
    );
    let auth = await AuthModel.findOneAndUpdate(
      { user_id: stringToObjectId(user_id), type: "email" },
      { username: email },
      { new: true }
    );
    return { comm, auth };
  }

  async update({ user_id, name, email, phone }) {
    let retName,
      retEmail,
      retPhone = null;
    if (name) retName = await this.updateName(user_id, name);
    if (email) retEmail = await this.updatePrimaryEmail(user_id, email);
    if (phone) retPhone = await this.updatePrimaryPhone(user_id, phone);

    return {
      user_id,
      name: retName,
      email: retEmail,
      phone: retPhone
    };
  }

  validateToken(token) {
    return this.TokenManager.validate(token);
  }

  //TODO
  verifyLogin(username, password, options = {}) {
    if (!username) throw ERR.USERNAME_REQ;
    if (!password) throw ERR.PASSWORD_REQ;
    options.loginBy = options.loginBy || "email";

    return new Promise((resolve, reject) => {
      this.getByUsername(username, options.loginBy, { returnPwd: true })
        .then(user =>
          Secure.hash(password, Buffer.from(user.password.salt, "base64")).then(hashedPwd => {
            if (user.password.hash !== hashedPwd.hash.toString("base64")) throw ERR.LOGIN_INVALID;
            user.password = undefined;
            resolve(user);
          })
        )
        .catch(e => reject(e));
    });
  }
}

module.exports = User;
