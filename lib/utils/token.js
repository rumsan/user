const JWT = require('jsonwebtoken');
const Secure = require('./secure');

class Token {
    constructor({app_secret}, options){
        if(!app_secret)
            throw new Error('No app secret was sent.');
        this.secret = app_secret;
    }

    generate(data, jwt_duration) {
        if(!this.secret)
            throw new Error('App Secret not defined');
        
        return JWT.sign({
            data: Secure.encrypt(JSON.stringify(data), this.secret)
        }, this.secret, {
            expiresIn: jwt_duration
        });
    }

    validate(token) {
        var me = this;
        if(!this.secret)
            throw new Error('App Secret not defined');

        return new Promise((resolve, reject) => {
            JWT.verify(token, me.secret, (err, decoded) => {
                if (err) {
                    reject(err);
                }
                let data = decoded.data || false;
                if(data){
                    data = JSON.parse(Secure.decrypt(data, me.secret))
                }
                resolve({user:data,decoded});
            });
        })
    }
}

module.exports = Token;