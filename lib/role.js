var crypto = require("crypto");
const { ERR } = require("./error");
const roleSchema = require("./models/role");
var RoleModel;

class Role {
  constructor({ mongoose }) {
    this.schema = roleSchema({ mongoose });
    RoleModel = this.model = mongoose.model("UserRole", this.schema, "roles");
  }

  add(payload) {
    let role = RoleModel.findOne({ name: payload.name });
    if (role.is_system) return role;
    if (role) return this.addPermission({ name: payload.name, permissions: payload.permissions });
    else {
      role = new RoleModel(payload);
      return role.save();
    }
  }

  list() {
    return RoleModel.find({}).sort({ name: 1 });
  }

  remove(name) {
    return RoleModel.findOneAndDelete({ name, is_system: false });
  }

  async listPermissions(name) {
    let role = await RoleModel.findOne({ name });
    return role.permissions;
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

  addPermission({ name, permissions }) {
    permissions = permissions || [];
    if (typeof permissions == "string") permissions = permissions.split(",");
    return RoleModel.findOneAndUpdate(
      { name, is_system: false },
      { $addToSet: { permissions } },
      { new: 1 }
    );
  }

  async hasPermission({ name, permission }) {
    let role = await RoleModel.findOne({ name });
    if (!role) return false;
    return role.permissions.indexOf(permission) > -1;
  }

  removePermission({ name, permission }) {
    return RoleModel.findOneAndUpdate(
      { name, is_system: false },
      { $pull: { permissions: permission } },
      { new: 1 }
    );
  }
}

module.exports = Role;
