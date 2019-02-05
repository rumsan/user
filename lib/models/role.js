module.exports = function({ mongoose }) {
  const { ObjectId } = mongoose.Schema.Types;

  const RoleSchema = mongoose.Schema(
    {
      name: { type: String, required: true, unique: true },
      permissions: [{ type: String }],
      expiry_date: Date,
      is_system: { type: Boolean, default: false }
    },
    {
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
  );

  return RoleSchema;
};
