const Sequelize = require("sequelize");

module.exports = function ({ db }) {
  // const { ObjectId } = mongoose.Schema.Types;

  // const RoleSchema = mongoose.Schema(
  //   {
  //     name: { type: String, required: true, unique: true },
  //     permissions: [{ type: String }],
  //     expiry_date: Date,
  //     is_system: { type: Boolean, default: false }
  //   },
  //   {
  //     timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  //   }
  // );

  const RoleSchema = db.define(
    "roles",
    {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      permissions: {
        type: Sequelize.ARRAY(Sequelize.STRING),
      },
      expiry_date: {
        type: Sequelize.DATE,
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

  return RoleSchema;
};
