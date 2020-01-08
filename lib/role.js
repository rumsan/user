var crypto = require("crypto");
const { ERR } = require("./error");
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
  constructor({ mongoose }) {
    this.schema = roleSchema({ mongoose });
    RoleModel = this.model = mongoose.model("UserRole", this.schema, "roles");
  }

  get(id) {
    return RoleModel.findOne({ _id: id });
  }

  async add(payload) {
    let role = await RoleModel.findOne({ name: payload.name });
    if (role) {
      if (role.is_system) return role;
      return this.addPermission({ name: payload.name, permissions: payload.permissions });
    } else {
      role = new RoleModel(payload);
      return role.save();
    }
  }

  list() {
    return RoleModel.find({}).sort({ name: 1 });
  }

  remove(id) {
    return RoleModel.findOneAndDelete({ _id: id, is_system: false });
  }

  async listPermissions(name) {
    let role = await RoleModel.findOne({ name });
    return role.permissions;
  }

  async getValidRoles() {
    let roles = await RoleModel.find({
      $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }]
    }).sort({ name: 1 });
    return roles.map(r => r.name);
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
    let validRoles = await RoleModel.find({
      name: { $in: roles },
      $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }]
    });

    let perms = [];
    validRoles.forEach(r => {
      perms = [...new Set([...perms, ...r.permissions])];
    });
    return perms;
  }

  addPermission({ id, permissions }) {
    permissions = permissions || [];
    if (typeof permissions == "string") permissions = permissions.split(",");
    return RoleModel.findOneAndUpdate(
      { _id: id, is_system: false },
      { $addToSet: { permissions } },
      { new: 1 }
    );
  }

  async hasPermission({ name, permission }) {
    let role = await RoleModel.findOne({ name });
    if (!role) return false;
    return role.permissions.indexOf(permission) > -1;
  }

  removePermission({ id, permissions }) {
    return RoleModel.findOneAndUpdate(
      { _id: id, is_system: false },
      { $pull: { permissions } },
      { new: 1 }
    );
  }
}

module.exports = Role;
