const JWT = require("jsonwebtoken");
const config = require("config");
const Secure = require("./secure");
const { ERR } = require("./error");

const jwtDuration = config.get("jwt.duration");
const jwtDurationLong = config.has("jwt.duration_long")
  ? config.get("jwt.duration_long")
  : jwtDuration;
const appSecret = config.get("app.secret");

const checkToken = token => {
  if (!appSecret) throw ERR.APP_SECRET;
  if (appSecret.length != 32) throw ERR.APP_SECRET32;
};

module.exports = {
  generate: data => {
    checkToken();
    return JWT.sign(
      {
        data: Secure.encrypt(JSON.stringify(data), appSecret)
      },
      appSecret,
      {
        expiresIn: jwtDuration
      }
    );
  },

  validate: async token => {
    checkToken();
    return new Promise((resolve, reject) => {
      JWT.verify(token, appSecret, (err, tokenData) => {
        if (err) throw ERR.TOKEN_INVALID;
        let data = tokenData.data || false;
        if (data) {
          data = JSON.parse(Secure.decrypt(data, appSecret));
        }
        resolve({ data, tokenData });
      });
    });
  }
};
