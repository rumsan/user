const auth = require("./auth");
const comm = require("./comm");
const user = require("./user");
const pat = require("./pat");

module.exports = function({ mongoose, modelConfig }) {
  modelConfig = Object.assign(
    {
      Auth: {},
      Comm: {},
      User: {},
      PAT: {}
    },
    modelConfig
  );

  const userCollName = modelConfig.User.collection || "users";
  const authCollName = userCollName + "_auth";
  const commCollName = userCollName + "_comm";
  const patCollName = userCollName + "_pat";

  if (userCollName != "users") {
    if (!modelConfig.User.name) throw "Must send User.name in modelConfig";

    modelConfig.Auth.name = modelConfig.Auth.name || modelConfig.User.name + "Auth";
    modelConfig.Comm.name = modelConfig.Comm.name || modelConfig.User.name + "Comm";
    modelConfig.PAT.name = modelConfig.PAT.name || modelConfig.User.name + "PAT";
  } else {
    modelConfig.User.name = "User";
    modelConfig.Auth.name = modelConfig.Auth.name || "Auth";
    modelConfig.Comm.name = modelConfig.Comm.name || "Comm";
    modelConfig.PAT.name = modelConfig.PAT.name || "PAT";
  }

  const AuthSchema = auth({ mongoose, modelConfig });
  const CommSchema = comm({ mongoose, modelConfig });
  const UserSchema = user({ mongoose, modelConfig });
  const PATSchema = pat({ mongoose, modelConfig });

  const AuthModel = mongoose.model(modelConfig.Auth.name, AuthSchema, authCollName);
  const CommModel = mongoose.model(modelConfig.Comm.name, CommSchema, commCollName);
  const UserModel = mongoose.model(modelConfig.User.name, UserSchema, userCollName);
  const PATModel = mongoose.model(modelConfig.PAT.name, PATSchema, patCollName);

  return {
    AuthModel,
    AuthSchema,
    CommModel,
    CommSchema,
    PATModel,
    PATSchema,
    UserModel,
    UserSchema
  };
};
