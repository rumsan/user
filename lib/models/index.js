const auth = require("./auth");
const comm = require("./comm");
const user = require("./user");
const pat = require("./pat");

module.exports = function ({ db, modelConfig }) {
  modelConfig = Object.assign(
    {
      Auth: {},
      Comm: {},
      User: {},
      PAT: {},
    },
    modelConfig
  );

  const userCollName = modelConfig.User.collection || "users";
  const authCollName = userCollName + "_auth";
  const commCollName = userCollName + "_comm";
  const patCollName = userCollName + "_pat";

  if (userCollName != "users") {
    if (!modelConfig.User.name) throw "Must send User.name in modelConfig";

    modelConfig.Auth.name =
      modelConfig.Auth.name || modelConfig.User.name + "Auth";
    modelConfig.Comm.name =
      modelConfig.Comm.name || modelConfig.User.name + "Comm";
    modelConfig.PAT.name =
      modelConfig.PAT.name || modelConfig.User.name + "PAT";
  } else {
    modelConfig.User.name = "User";
    modelConfig.Auth.name = modelConfig.Auth.name || "Auth";
    modelConfig.Comm.name = modelConfig.Comm.name || "Comm";
    modelConfig.PAT.name = modelConfig.PAT.name || "PAT";
  }

  const AuthSchema = auth({ db, modelConfig });
  const CommSchema = comm({ db, modelConfig });
  const UserSchema = user({ db, modelConfig });
  const PATSchema = pat({ db, modelConfig });

  const AuthModel = db.define(modelConfig.Auth.name, AuthSchema, authCollName);
  const CommModel = db.define(modelConfig.Comm.name, CommSchema, commCollName);
  const UserModel = db.define(modelConfig.User.name, UserSchema, userCollName);
  const PATModel = db.define(modelConfig.PAT.name, PATSchema, patCollName);

  return {
    AuthModel,
    AuthSchema,
    CommModel,
    CommSchema,
    PATModel,
    PATSchema,
    UserModel,
    UserSchema,
  };
};
