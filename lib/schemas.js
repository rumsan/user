const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const createSchemaDefault = (schema, collectionName) => {
  return mongoose.Schema(schema, {
    collection: collectionName,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  });
};

module.exports = {
  UserSchema: ({ schema, collectionName, fnCreateSchema } = {}) => {
    schema = schema || {};
    collectionName = collectionName || "users";

    schema = Object.assign(
      {
        name: {
          first: { type: String, required: true },
          initials: String,
          last: String,
          salutation: String,
          suffix: String
        },
        email: { type: String, required: true, unique: true },
        email_verified: { type: Boolean, required: true, default: false },
        phone: String,
        phone_verified: { type: Boolean, required: true, default: false },
        gender: { type: String, required: true, default: "U", enum: ["M", "F", "O", "U"] },
        dob: Date,
        password: {
          hash: { type: String, required: true, select: false },
          salt: { type: String, required: true, select: false }
        },
        is_approved: { type: Boolean, default: true, required: true },
        picture: String,
        social: Object,
        roles: [String],
        is_active: { type: Boolean, required: true, default: true },
        created_by: { type: ObjectId, ref: "User" },
        updated_by: { type: ObjectId, ref: "User" }
      },
      schema
    );
    let createSchema = fnCreateSchema || createSchemaDefault;
    schema = createSchema(schema, collectionName);

    schema.virtual("name.full").get(function () {
      if (this.name.initials)
        return this.name.first + " " + this.name.initials + " " + this.name.last;
      else return this.name.first + " " + this.name.last;
    });
    return schema;
  },

  RoleSchema: ({ schema, collectionName, fnCreateSchema } = {}) => {
    schema = schema || {};
    collectionName = collectionName || "roles";

    schema = Object.assign(
      {
        name: { type: String, required: true, unique: true },
        permissions: [{ type: String }],
        expiry_date: Date,
        is_system: { type: Boolean, default: false }
      },
      schema
    );
    let createSchema = fnCreateSchema || createSchemaDefault;
    return createSchema(schema, collectionName);
  },

  PATSchema: ({ schema, collectionName, fnCreateSchema } = {}) => {
    schema = schema || {};
    collectionName = collectionName || "users_pat";

    schema = Object.assign(
      {
        user_id: { type: ObjectId, required: true, ref: "User" },
        name: { type: String, required: true },
        key: { type: String, required: true, unique: true },
        secretHash: { type: String, required: true },
        salt: { type: String, required: true },
        expiry_date: Date,
        scopes: [{ type: String }]
      },
      schema
    );
    let createSchema = fnCreateSchema || createSchemaDefault;
    return createSchema(schema, collectionName);
  }
};
