const Secure = require("./secure");
const { ERR } = require("./error");

class Pwd {
  constructor({ models, messenger, smsService }) {
    this.models = models;
    this.messenger = messenger;
    this.smsService = smsService;
  }

  resetPassword(user_id, password) {
    if (!user_id) throw ERR.USERID_REQ;
    if (!password) throw ERR.PASSWORD_REQ;

    return new Promise((resolve, reject) => {
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
            .then((d) => {
              if (d) resolve(true);
              else resolve(false);
            })
            .catch((err) => reject(err));
        })
        .catch((err) => reject(err));
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

  async forgotPassword(username) {
    const loginBy = username.includes("@") ? "email" : "phone";
    let res;
    if (loginBy === "email") {
      res = await this.models.findOne({ email: username });
      if (!res) throw ERR.EMAIL_NOEXISTS;
    }
    if (loginBy === "phone") {
      res = await this.models.findOne({ phone: username });
      if (!res) throw ERR.PHONE_NOEXISTS;
    }
    return new Promise((resolve, reject) => {
      const tkn = Math.floor(100000 + Math.random() * 900000).toString();
      const date = new Date();
      const expiresIn = date.setDate(date.getDate() + 1);
      if (loginBy === "email") {
        this.messenger
          .send({
            to: res.email,
            data: { name: res.name.full, token: tkn },
            template: "forgot",
          })
          .then(async () => {
            await this.models.findByIdAndUpdate(
              res._id,
              {
                $set: { user_token: tkn, token_expiration: expiresIn },
              },
              { new: true }
            );
          })
          .then(
            resolve({
              msg: "Please check email to reset password",
              success: true,
            })
          )
          .catch((e) => reject(e));
      }
      if (loginBy === "phone") {
        this.smsService
          .send({
            to: res.phone,
            data: { name: res.name.full, token: tkn },
            template: "forgot",
          })
          .then(async () => {
            await this.models.findByIdAndUpdate(
              res._id,
              {
                $set: { user_token: tkn, token_expiration: expiresIn },
              },
              { new: true }
            );
          })
          .then(
            resolve({
              msg: "Please check sms to reset password",
              success: true,
            })
          )
          .catch((e) => reject(e));
      }
    });
  }
}

module.exports = Pwd;
