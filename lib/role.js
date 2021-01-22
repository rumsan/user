const { RoleSchema } = require("./schemas");

function arrayContainsArray(superset, subset) {
  if (subset.length === 0 || superset.length < subset.length) {
    return false;
  }
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < subset.length; i++) {
    if (superset.indexOf(subset[i]) === -1) return false;
  }
  return true;
}

class Role {
  constructor({ mongoose }) {
    this.model = mongoose.model("Role", RoleSchema(), "roles");
  }

  get(id) {
    return this.model.findOne({ _id: id });
  }

  async add(payload) {
    const role = await this.model.findOne({ name: payload.name });
    if (role) {
      if (role.is_system) return role;
      return this.addPermission({
        id: role._id,
        permissions: payload.permissions,
      });
    }
    return this.model.create(payload);
  }

  list() {
    return this.model.find({}).sort({ name: 1 });
  }

  remove(id) {
    return this.model.findOneAndDelete({ _id: id, is_system: false });
  }

  async listPermissions(name) {
    const role = await this.model.findOne({ name });
    return role.permissions;
  }

  async getValidRoles() {
    const roles = await this.model
      .find({
        $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }],
      })
      .sort({ name: 1 });
    return roles.map((r) => r.name);
  }

  async isValidRole(roles) {
    if (typeof roles === "string") roles = roles.split(",");
    const vroles = await this.getValidRoles();
    return arrayContainsArray(vroles, roles);
  }

  async calculatePermissions(name) {
    if (!name) return [];
    let roles = name;
    if (typeof name === "string") roles = name.split(",");
    const validRoles = await this.model.find({
      name: { $in: roles },
      $or: [{ expiry_date: null }, { expiry_date: { $gt: new Date() } }],
    });

    let perms = [];
    validRoles.forEach((r) => {
      perms = [...new Set([...perms, ...r.permissions])];
    });
    return perms;
  }

  addPermission({ id, permissions }) {
    permissions = permissions || [];
    if (typeof permissions === "string") permissions = permissions.split(",");
    return this.model.findOneAndUpdate(
      { _id: id, is_system: false },
      { $addToSet: { permissions } },
      { new: 1 }
    );
  }

  async hasPermission({ name, permission }) {
    const role = await this.model.findOne({ name });
    if (!role) return false;
    return role.permissions.indexOf(permission) > -1;
  }

  removePermission({ id, permissions }) {
    return this.model.findOneAndUpdate(
      { _id: id, is_system: false },
      { $pull: { permissions } },
      { new: 1 }
    );
  }
}

module.exports = Role;
