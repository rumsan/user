const { Secure } = require("../utils");
const { ERR } = require("./error");

class Pwd {
  constructor({ models }) {
    this.models = models;
  }

  resetPassword(user_id, password) {
    if (!user_id) throw ERR.USERID_REQ;
    if (!password) throw ERR.PASSWORD_REQ;

    return new Promise((resolve, reject) => {
      this.models.findOne({ _id: user_id }).then((user) => {
        Secure.saltAndHash(password)
          .then((pwdHash) => {
            let passwordData = {
              hash: pwdHash.hash.toString("base64"),
              salt: pwdHash.salt.toString("base64"),
            };
            this.models
              .findByIdAndUpdate(user_id, {
                $set: { password: passwordData },
              })
              .then((d) => resolve(d))
              .catch((err) => reject(err));
          })
          .catch((err) => reject(err));
      });
    });
  }

  changePassword(user_id, oldPassword, newPassword) {
    if (oldPassword.toLowerCase() === newPassword.toLowerCase())
      throw ERR.PWD_SAME;
    return new Promise((resolve, reject) => {
      let user;
      this.models
        .findOne({ _id: user_id, is_active: true })
        .select("password")
        .then((u) => {
          if (!u) throw ERR.USER_NOEXISTS;
          user = u;
          return Secure.makeHash(
            oldPassword,
            Buffer.from(u.password.salt, "base64")
          );
        })
        .then((hashedOldPwd) => {
          if (user.password.hash !== hashedOldPwd.hash.toString("base64"))
            throw ERR.PWD_NOTMATCH;

          return Secure.saltAndHash(newPassword);
        })
        .then((hashedNewPwd) => {
          let password = {
            hash: hashedNewPwd.hash.toString("base64"),
            salt: hashedNewPwd.salt.toString("base64"),
          };
          return this.models.findByIdAndUpdate(
            { _id: user_id },
            { $set: { password: password } },
            { new: true }
          );
        })
        .then((d) => resolve(true))
        .catch((err) => reject(err));
    });
  }

  forgotPassword(username, loginBy) {
    const notExistMsg =
      loginBy === "email" ? "Email does not exists" : "Phone does not exists";
    let query = {};
    query[loginBy] = username;
    return new Promise((resolve, reject) => {
      this.models.findOne(query).then((d) => {
        if (d) {
          let tkn = Math.floor(100000 + Math.random() * 900000).toString();
          let date = new Date();
          let expiresIn = date.setDate(date.getDate() + 1);
          this.models
            .findOne(query)
            .then((user) => {
              return this.models.findByIdAndUpdate(
                { _id: user._id },
                { $set: { user_token: tkn, token_expiration: expiresIn } },
                { new: true }
              );
            })
            .then((d) => resolve(d))
            .catch((e) => reject(e));
        } else {
          resolve({ msg: notExistMsg });
        }
      });
    });
  }
}

module.exports = Pwd;
