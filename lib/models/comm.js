module.exports = function ({ db, modelConfig }) {
  let CommSchema;
  // const { ObjectId } = mongoose.Schema.Types;

  // const CommSchema = mongoose.Schema(
  //   {
  //     user_id: { type: ObjectId, required: true, ref: modelConfig.User.name },
  //     type: { type: String, required: true },
  //     address: { type: String, required: true },
  //     token: String,
  //     token_expiration: Number,
  //     is_verified: { type: Boolean, required: true, default: false },
  //     is_primary: { type: Boolean, required: true, default: false },
  //     verified_on: Date,
  //     created_by: { type: ObjectId, ref: modelConfig.User.name },
  //     updated_by: { type: ObjectId, ref: modelConfig.User.name }
  //   },
  //   {
  //     timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  //   }
  // );

  // CommSchema.index({ user_id: 1, address: 1 }, { unique: true });
  //TODO one address can be is_primary only once.
  return CommSchema;
};
