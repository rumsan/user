//const mongoose = require("mongoose");
let schemas = require("./schemas");
let config = require("config");
const { Secure, NameParser, ERR, TokenUtil, RoleUtil } = require("./utils");

const sanitizeGender = gender => {
  try {
    gender = gender.substring(0, 1).toUpperCase();
    if (gender === "M" || gender === "F") return gender;
    else return "O";
  } catch (e) {
    return "U";
  }
};

class User {
  constructor(cfg) {
    Object.assign(this, cfg);
    this.options = this.options || {};
    this.controllers = this.controllers || {};

    //options
    this.options.requireApproval = this.options.requireApproval || false;

    let mongoose = cfg.mongoose;
    this.model =
      cfg.model ||
      mongoose.model(
        "User",
        schemas.UserSchema({
          schema: cfg.schema,
          collectionName: cfg.collectionName,
          fnCreateSchema: cfg.fnCreateSchema
        })
      );
  }

  async addRoles({ user_id, roles }) {
    if (!this.controllers.role) throw Error("Must pass roleController");
    roles = roles || [];
    if (typeof roles == "string") roles = roles.split(",");

    let isValid = await this.controllers.role.isValidRole(roles);
    if (!isValid) throw ERR.ROLE_NOEXISTS;

    return this.model
      .findByIdAndUpdate(user_id, { $addToSet: { roles } }, { password: 0, new: 1 })
      .select("-password");
  }

  removeRole({ user_id, role }) {
    if (!this.controllers.role) throw Error("Must pass roleController");
    return this.model
      .findByIdAndUpdate(user_id, { $pull: { roles: role } }, { password: 0, new: 1 })
      .select("-password");
  }

  async authenticate({ username, password, tokenData, loginBy = "email" }) {
    if (!username) throw ERR.USERNAME_REQ;
    if (!password) throw ERR.PASSWORD_REQ;

    let user = await this.model.findOne({ email: username });
    if (!user) throw ERR.USER_NOEXISTS;

    const hashedPwd = await Secure.hash(password, Buffer.from(user.password.salt, "base64"));
    if (user.password.hash !== hashedPwd.hash.toString("base64")) throw ERR.LOGIN_INVALID;
    user.password = undefined;

    let access_token = await this.generateToken(user, tokenData);
    return { user, access_token };
  }

  async authenticateExternal({ service, service_id, data, tokenData }, options = {}) {
    options.useEmailToFindUser = options.useEmailToFindUser || false;

    let query = {};
    if (options.useEmailToFindUser) query["email"] = data.email;
    else query[`social.${service}.id`] = service_id;

    let user = await this.model.findOne(query);

    data.social = {};
    data.social[service] = {
      id: service_id,
      data: data.social_data
    };

    if (user) {
      user.social = data.social;
      await user.save();
    } else {
      user = await this.create(data);
    }

    let access_token = await this.generateToken(user, tokenData);
    return { user, access_token };
  }

  changeStatus(id, status) {
    return this.model
      .findByIdAndUpdate({ _id: id }, { is_active: status }, { new: true })
      .select("-password");
  }

  async create(payload, options = {}) {
    payload = Object.assign({}, payload);
    if (!payload.name) throw ERR.NAME_REQ;
    if (typeof payload.name == "string") payload.name = NameParser.parse(payload.name);

    payload.password = payload.password || Math.floor(100000 + Math.random() * 900000).toString();
    let pwdHash = await Secure.saltAndHash(payload.password);
    payload.password = {
      hash: pwdHash.hash.toString("base64"),
      salt: pwdHash.salt.toString("base64")
    };

    if (this.options.requireApproval) payload.is_approved = false;

    payload.gender = sanitizeGender(payload.gender);
    let user = await this.model.create(payload);
    return this.getById(user._id);
  }

  async generateToken(user, tokenData = {}) {
    let data = {};
    if (typeof tokenData === "function") data = await tokenData(user);
    else data = tokenData;
    // let permissions = [];
    // if (this.controllers.role) {
    //   permissions = await this.controllers.role.calculatePermissions(user.roles);
    // }

    Object.assign(data, {
      user_id: user.id,
      name_first: user.name.first,
      name: user.name.full
      //permissions
    });
    return TokenUtil.generate(data);
  }

  getById(user_id, { selectFields } = {}) {
    /*
      Options:
        showFields (Boolean): show hidden fields like password.
    */
    selectFields = selectFields || "";
    return this.model.findOne({ _id: user_id, is_active: true }, selectFields);
  }

  getByEmail(email, { selectFields } = {}) {
    /*
      Options:
        showFields (Boolean): show hidden fields like password.
    */
    selectFields = selectFields || "";
    return this.model.findOne({ email, is_active: true }, selectFields);
  }

  getLean(userId) {
    return this.model.findById(userId).lean();
  }

  //TODO
  getMe(token, options) {
    return new Promise((resolve, reject) => {
      this.TokenManager.validate(token)
        .then(token_data => this.getById(token_data.data.user_id, options))
        .then(data => resolve(data))
        .catch(err => reject(err));
    });
  }

  list() {
    return this.model.find({}, { password: 0 });
  }

  restore(id) {
    return this.changeStatus(id, true);
  }

  suspend(id) {
    return this.changeStatus(id, false);
  }

  update(id, payload, options = {}) {
    payload = Object.assign({}, payload);
    if (payload.name && typeof payload.name == "string")
      payload.name = NameParser.parse(payload.name);
    ["password", "is_approved", "is_active", "roles"].forEach(e => delete payload[e]);
    payload.gender = sanitizeGender(payload.gender);
    return this.model.findByIdAndUpdate(id, payload, { new: 1 });
  }

  async validateToken(token) {
    let info = await TokenUtil.validate(token);
    let user = await this.getById(info.data.user_id);
    let permissions = [];
    if (user.roles) permissions = await this.controllers.role.calculatePermissions(user.roles);
    return {
      info,
      user,
      permissions,
      hasPermission: perms => {
        return RoleUtil.hasPermission(perms, permissions);
      }
    };
  }
}

module.exports = User;
