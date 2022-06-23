const _ = require("lodash");
const Sequelize = require("sequelize");

module.exports = function ({ db, modelConfig }) {
  // const { ObjectId } = mongoose.Schema.Types;
  schema = modelConfig.User.schema || {};

  let validRoles = modelConfig.roles || null;
  if (typeof validRoles == "string") validRoles = validRoles.split(",");
  let roleDef = {
    type: Sequelize.STRING,
  };

  if (validRoles) {
    roleDef = {
      // type: Sequelize.STRING,
      // enum: modelConfig.roles,
      type: Sequelize.ENUM(modelConfig.roles),
    };
  }

  let baseSechma = {
    name: {
      first: { type: Sequelize.STRING, allowNull: false },
      initials: {
        type: Sequelize.STRING,
      },
      last: {
        type: Sequelize.STRING,
      },
      salutation: {
        type: Sequelize.STRING,
      },
      suffix: {
        type: Sequelize.STRING,
      },
    },
    password: {
      hash: { type: Sequelize.STRING, allowNull: false },
      salt: Sequelize.STRING,
    },
    user_token: {
      type: Sequelize.STRING,
    },
    token_expiration: {
      type: Sequelize.NUMBER,
    },
    comms: [
      {
        type: Sequelize.INTEGER,
        references: {
          model: modelConfig.Comm.name,
          key: "id",
        },
      },
    ],

    roles: [roleDef],
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, default: true },
    created_by: {
      // type: ObjectId, ref: modelConfig.User.name
      type: Sequelize.INTEGER,
      references: {
        model: modelConfig.User.name,
        key: "id",
      },
    },
    updated_by: {
      type: Sequelize.INTEGER,
      references: {
        model: modelConfig.User.name,
        key: "id",
      },
    },
  };
  // let baseSechma = {
  //   name: {
  //     first: { type: Sequelize.STRING, required: true },
  //     initials: String,
  //     last: String,
  //     salutation: String,
  //     suffix: String
  //   },
  //   password: {
  //     hash: { type: String, required: true },
  //     salt: String
  //   },
  //   user_token: String,
  //   token_expiration: Number,
  //   comms: [{ type: ObjectId, ref: modelConfig.Comm.name }],
  //   roles: [roleDef],
  //   is_active: { type: Boolean, required: true, default: true },
  //   created_by: { type: ObjectId, ref: modelConfig.User.name },
  //   updated_by: { type: ObjectId, ref: modelConfig.User.name }
  // };

  const combinedSchema = Object.assign(schema, baseSechma);

  const UserSchema = db.define(combinedSchema, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  });

  UserSchema.virtual("name.full").get(function () {
    if (this.name.initials)
      return this.name.first + " " + this.name.initials + " " + this.name.last;
    else return this.name.first + " " + this.name.last;
  });

  UserSchema.virtual("email").get(function () {
    try {
      if (this.comms.length == 0) return null;
      let email = this.comms.find((e) => {
        return e.type === "email" && e.is_primary;
      });
      if (email) return email.address;

      email = this.comms.find((e) => {
        return e.type === "email";
      });
      if (email) return email.address;
    } catch (e) {
      return null;
    }
  });

  UserSchema.virtual("phone").get(function () {
    try {
      if (this.comms.length == 0) return null;
      let phone = this.comms.find((e) => {
        return e.type === "phone" && e.is_primary;
      });
      if (phone) return phone.address;

      phone = this.comms.find((e) => {
        return e.type === "phone";
      });
      if (phone) return phone.address;
    } catch (e) {
      return null;
    }
  });

  UserSchema.virtual("token");

  return UserSchema;
};
