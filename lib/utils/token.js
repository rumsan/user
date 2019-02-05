const JWT = require('jsonwebtoken');
const Secure = require('./secure');
const { ERR } = require('../error');

class Token {
    constructor({ appSecret }) {
        if (!appSecret) throw ERR.APP_SECRET;
        if (appSecret.length != 32) throw ERR.APP_SECRET32;
        this.secret = appSecret;
    }

    generate(data, jwt_duration) {
        return JWT.sign({
            data: Secure.encrypt(JSON.stringify(data), this.secret)
        }, this.secret, {
                expiresIn: jwt_duration
            });
    }

    validate(token) {
        var me = this;
        return new Promise((resolve, reject) => {
            JWT.verify(token, me.secret, (err, tokenData) => {
                if (err) throw ERR.TOKEN_INVALID;
                let data = tokenData.data || false;
                if (data) {
                    data = JSON.parse(Secure.decrypt(data, me.secret))
                }
                resolve({ data, tokenData });
            });
        })
    }
}

module.exports = Token;