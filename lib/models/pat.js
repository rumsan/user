module.exports = function({ mongoose, modelConfig }) {
  const { ObjectId } = mongoose.Schema.Types;

  const PATSchema = mongoose.Schema(
    {
      user_id: { type: ObjectId, required: true, ref: modelConfig.User.name },
      name: { type: String, required: true },
      key: { type: String, required: true, unique: true },
      secretHash: { type: String, required: true },
      salt: { type: String, required: true },
      expiry_date: Date,
      scopes: [{ type: String }]
    },
    {
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
    }
  );

  return PATSchema;
};
