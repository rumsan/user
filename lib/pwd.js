const {Secure} = require('./utils');

class Pwd {
    constructor({models, mailer}){
        this.models = models;
        this.mailer = mailer;
    }

    resetPassword(user_id, pwd){
        return new Promise((resolve, reject)=>{
            Secure.saltAndHash(pwd)
            .then(pwdHash => {
                let password = {
                    hash: pwdHash.hash.toString('base64'),
                    salt: pwdHash.salt.toString('base64')
                }
                this.models.UserModel.findByIdAndUpdate(user_id, {
                    $set: {password: password}
                })
                .then(d=>{
                    if(d)
                        resolve(true)
                    else
                        resolve(false)
                })
                .catch(err=>reject(err))
            })
            .catch(err=>reject(err))
        })
    }
}

module.exports = Pwd;