var crypto = require("crypto");
const { ERR } = require("./error");
const { Op } = require("sequelize");
const roleSchema = require("./models/role");
var RoleModel;

function arrayContainsArray(superset, subset) {
  if (0 === subset.length || superset.length < subset.length) {
    return false;
  }
  for (var i = 0; i < subset.length; i++) {
    if (superset.indexOf(subset[i]) === -1) return false;
  }
  return true;
}

class Role {
  constructor({ db }) {
    // this.schema = roleSchema({ db });

    // RoleModel = this.model = mongoose.model("UserRole", this.schema instance of roleSchema({db}), "roles");
    RoleModel = roleSchema({ db });

    // RoleModel = db.define("UserRole", this.schema, {
    //   tableName: "roles",
    // });
  }
  get(id) {
    return RoleModel.findByPk(id);
  }

  async add(payload) {
    let role = await RoleModel.findOne({ where: { name: payload.name } });

    if (role) {
      if (role.is_system) return role;
      return this.addPermission({
        name: payload.name,
        permissions: payload.permissions,
      });
    } else {
      role = await RoleModel.create(payload);
      return role;
    }
  }

  list() {
    return RoleModel.findAll({
      order: [["name", "ASC"]],
    });
  }

  remove(id) {
    return RoleModel.destroy({ where: { id, is_system: false } });
  }

  async listPermissions(name) {
    let role = await RoleModel.findOne({ where: { name } });
    return role.permissions;
  }

  async getValidRoles() {
    let roles = await RoleModel.findAll({
      where: {
        [Op.or]: [
          {
            expiry_date: null,
          },
          {
            expiry_date: {
              [Op.gt]: new Date(),
            },
          },
        ],
      },
      order: [["name", "ASC"]],
    });

    return roles.map((r) => r.name);
  }

  async isValidRole(roles) {
    if (typeof roles == "string") roles = roles.split(",");
    let vroles = await this.getValidRoles();
    return arrayContainsArray(vroles, roles);
  }

  async calculatePermissions(name) {
    if (!name) return [];
    let roles = name;
    if (typeof name == "string") roles = name.split(",");

    let validRoles = await RoleModel.findAll({
      where: {
        //todo: "name" and figure out what the function does
        [Op.or]: [
          {
            expiry_date: null,
          },
          {
            expiry_date: {
              [Op.gt]: new Date(),
            },
          },
        ],
      },
    });

    // let validRoles = await RoleModel.find({
    //   name: { $in: roles },
    //   $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }],
    // });

    let perms = [];
    validRoles.forEach((r) => {
      perms = [...new Set([...perms, ...r.permissions])];
    });
    return perms;
  }

  addPermission({ id, permissions }) {
    permissions = permissions || [];
    if (typeof permissions == "string") permissions = permissions.split(",");

    return RoleModel.update(
      {
        permissions: sequelize.fn(
          "array_append",
          sequelize.col("permissions"),
          permissions
        ),
      },
      { where: { id } }
    );
  }

  async hasPermission({ name, permission }) {
    let role = await RoleModel.findOne({ where: { name } });
    if (!role) return false;
    return role.permissions.indexOf(permission) > -1;
  }

  removePermission({ id, permissions }) {
    return RoleModel.update(
      {
        permissions: sequelize.fn(
          "array_remove",
          sequelize.col("permissions"),
          permissions
        ),
      },
      { where: { id, is_system: false } }
    );
    // return RoleModel.findOneAndUpdate(
    //   { _id: id, is_system: false },
    //   { $pull: { permissions } },
    //   { new: 1 }
    // );
  }
}

module.exports = Role;
