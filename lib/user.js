/* eslint-disable camelcase */
// const mongoose = require("mongoose");
const schemas = require("./schemas");
const { Secure, NameParser, ERR, TokenUtil, RoleUtil } = require("./utils");
const pwd = require("../lib/utils/pwd");

const sanitizeGender = (gender) => {
  try {
    gender = gender.substring(0, 1).toUpperCase();
    if (gender === "M" || gender === "F") return gender;
    return "O";
  } catch (e) {
    return "U";
  }
};

class User {
  constructor(cfg) {
    Object.assign(this, cfg);
    this.options = this.options || {};
    this.controllers = this.controllers || {};

    // options
    this.options.requireApproval = this.options.requireApproval || false;

    const { mongoose } = cfg;
    this.model =
      cfg.model ||
      mongoose.model(
        "User",
        schemas.UserSchema({
          schema: cfg.schema,
          collectionName: cfg.collectionName,
          fnCreateSchema: cfg.fnCreateSchema,
        })
      );
    this.messenger = cfg.messenger;
    this.smsService = cfg.smsService;
    this.PasswordManager = new pwd({
      models: this.model,
      messenger: cfg.messenger,
      smsService: cfg.smsService,
    });
  }

  async addRoles({ user_id, roles }) {
    if (!this.controllers.role) throw Error("Must pass roleController");
    roles = roles || [];
    if (typeof roles === "string") roles = roles.split(",");

    const isValid = await this.controllers.role.isValidRole(roles);
    if (!isValid) throw ERR.ROLE_NOEXISTS;

    return this.model
      .findByIdAndUpdate(
        user_id,
        { $addToSet: { roles } },
        { password: 0, new: 1 }
      )
      .select("-password");
  }

  removeRole({ user_id, role }) {
    if (!this.controllers.role) throw Error("Must pass roleController");
    return this.model
      .findByIdAndUpdate(
        user_id,
        { $pull: { roles: role } },
        { password: 0, new: 1 }
      )
      .select("-password");
  }

  async authenticate({ username, password, tokenData, loginBy = "email" }) {
    if (!username) throw ERR.USERNAME_REQ;
    if (!password) throw ERR.PASSWORD_REQ;

    let user = null;
    if (loginBy === "email")
      user = await this.model.findOne(
        { email: username },
        "+password.hash +password.salt"
      );
    if (loginBy === "phone")
      user = await this.model.findOne(
        { phone: username },
        "+password.hash +password.salt"
      );
    if (!user) throw ERR.USER_NOEXISTS;
    if (!user.is_approved) throw ERR.USER_NOAPPROVED;
    const hashedPwd = await Secure.makeHash(
      password,
      Buffer.from(user.password.salt, "base64")
    );
    if (user.password.hash !== hashedPwd.hash.toString("base64"))
      throw ERR.LOGIN_INVALID;
    user.password = undefined;

    const accessToken = await this.generateToken(user, tokenData);
    return { user, accessToken };
  }

  async authenticateExternal(
    { service, service_id, data, tokenData },
    options = {}
  ) {
    options.useEmailToFindUser = options.useEmailToFindUser || false;

    const query = {};
    if (options.useEmailToFindUser) query.email = data.email;
    else query[`social.${service}.id`] = service_id;

    let user = await this.model.findOne(query);

    data.social = {};
    data.social[service] = {
      id: service_id,
      data: data.social_data,
    };

    if (user) {
      user.social = data.social;
      await user.save();
    } else {
      user = await this.create(data);
    }

    if (!user.is_active) throw ERR.USER_NOEXISTS;

    const access_token = await this.generateToken(user, tokenData);
    return { user, access_token };
  }

  changeStatus(id, status) {
    return this.model
      .findByIdAndUpdate({ _id: id }, { is_active: status }, { new: true })
      .select("-password");
  }

  // eslint-disable-next-line no-unused-vars
  async create(payload, options = {}) {
    payload = { ...payload };
    const rawPassword = payload.password;
    if (!payload.name) throw ERR.NAME_REQ;
    if (typeof payload.name === "string")
      payload.name = NameParser.parse(payload.name);

    payload.password =
      payload.password ||
      Math.floor(100000 + Math.random() * 900000).toString();
    const pwdHash = await Secure.saltAndHash(payload.password);
    payload.password = {
      hash: pwdHash.hash.toString("base64"),
      salt: pwdHash.salt.toString("base64"),
    };

    if (this.options.requireApproval) payload.is_approved = false;

    payload.gender = sanitizeGender(payload.gender);
    const user = await this.model.create(payload);
    if (user) {
      const notify = await this.messenger.checkNotifyMethod(payload);
      if (notify === "email") {
        this.messenger.send({
          to: user.email,
          data: {
            name: user.name.full,
            email: user.email,
            password: rawPassword,
          },
          template: "create_user",
        });
      } else {
        this.smsService.send({
          to: user.phone,
          data: {
            name: user.name.full,
            phone: user.phone,
            password: rawPassword,
          },
          template: "create_user",
        });
      }
    }
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
      name: user.name.full,
      // permissions
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

  // TODO
  getMe(token, options) {
    return new Promise((resolve, reject) => {
      this.TokenManager.validate(token)
        .then((token_data) => this.getById(token_data.data.user_id, options))
        .then((data) => resolve(data))
        .catch((err) => reject(err));
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

  // eslint-disable-next-line no-unused-vars
  update(id, payload, options = {}) {
    payload = { ...payload };
    if (payload.name && typeof payload.name === "string") {
      payload.name = NameParser.parse(payload.name);
    }
    ["password", "is_approved", "is_active", "roles"].forEach(
      (e) => delete payload[e]
    );
    payload.gender = sanitizeGender(payload.gender);
    return this.model.findByIdAndUpdate(id, payload, { new: 1 });
  }

  async validateToken(token, options = {}) {
    const info = await TokenUtil.validate(token);
    const selectFields = options.userFields || "";
    const user = await this.getById(info.data.user_id, { selectFields });
    let permissions = [];
    if (user.roles)
      permissions = await this.controllers.role.calculatePermissions(
        user.roles
      );
    return {
      info,
      user,
      permissions,
      hasPermission: (perms) => RoleUtil.hasPermission(perms, permissions),
    };
  }
}

module.exports = User;
