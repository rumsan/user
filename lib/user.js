/** @const */
const _ = require('lodash');
/** @const */
const fs = require('fs');
/** @const */
const {coroutine} = require('bluebird');
/** @const */
const {Promise} = require('bluebird');
/** @const */
const handlebars = require('handlebars');
/** @const */
const models = require('./models');
/** @const */
const utils = require('./utils');
const pwd = require('./pwd');
/** @const */
const {Secure, NameParser} = require('./utils');
/** @const */
const tokenExpiration = 24 * 7 * 1000 * 60 * 60;
/** @const */
const tokenExpireBalancer = 3 * 1000;

var TokenUtil, AuthModel, CommModel, 
    UserModel, Mongoose, Mailer;

const stringToObjectId = (id) => {
    return Mongoose.Types.ObjectId(id);
}

const addCommsWithoutUserIdCheck = (user_id, comms) => {
    if(!Array.isArray(comms))
        comms = [comms];
    
    let arrComm = _.cloneDeep(comms);
    let promises = []

    _.each(arrComm, (comm)=>{
        comm.user_id = stringToObjectId(user_id);
        comm.token = Math.floor(100000 + Math.random() * 900000);
        comm.token_expiration = Date.now() + tokenExpiration - tokenExpireBalancer;

        promises.push(
            new Promise((resolve)=>{
                CommModel.findOne({user_id: stringToObjectId(user_id), address:comm.address}, (err, result) => {
                    if(!err){
                        if(!result){
                            let record = new CommModel(comm);
                            record.save(function(err, d){
                                resolve(d);
                            });
                        } else {
                            resolve(null)
                        }
                    } else {
                        resolve(null);
                    }
                })
            }
        ))
    })
    
    return Promise.all(promises);
};


class User {
    /**
        * @mongoose {object} Send reference to mongoose from your application.
        * @mailer {object} Send reference to fully configured nodemailer reference.
        * @app_secret {string} Your application secret. Must be 12 characters
        * @options {object} These are the valid options
        * @return {number} result of the sum value.
    */
    constructor({mongoose, mailer, app_secret, options}) {
    if (!mongoose)
        throw 'Mongoose is undefined';
    if(!app_secret)
        throw 'App Secret is undefined.';
    if(app_secret.length!=32)
        throw 'App Secret must be 32 characters.';

        //Private variables
        this.models = models(mongoose);
        this.AuthModel = AuthModel = this.models.AuthModel;
        this.CommModel = CommModel = this.models.CommModel;
        this.UserModel = UserModel = this.models.UserModel;
        TokenUtil = new utils.Token({app_secret});
        Mongoose = mongoose;

        //activate password manager
        this.PasswordManager = new pwd({models: this.models, mailer});

        this.options = options || {};
        this.options.jwt_duration = this.options.jwt_duration || 1000 * 60 * 20;
        this.mailer = mailer || {disable:true};

        
    }

    validateToken (token) {
        return TokenUtil.validate(token);
    }

    /**
     * 
     * @param {string} to - receiver email address
     * @param {object} data - data to be replaced in the template
     * @param {string} template - html template
     * @return {Boolean} success
     */
    sendMessage(to, data, template) {
        if(Mailer.disabled){
            console.log('Mailer is disabled');
            return;
        }
        
        const mailOptions = Object.assign({},
            Mailer.options[template], {
                data,
                to
            }
        );

        return new Promise((resolve, reject) => {
            fs.readFile(mailOptions.html, {
                encoding: 'utf-8'
            }, function(err, html) {
                if (err) reject(err);
                var template = handlebars.compile(html);
                var htmlToSend = template(data);
                mailOptions.html = htmlToSend;

                if (data.subject) {
                    mailOptions.subject = data.subject;
                }

                Mailer.transporter.sendMail(mailOptions);
                resolve(true);
            });
        });
    }

    addAuth({user_id, username, type}) {
        return new Promise((resolve, reject) => {
            AuthModel.findOne({username}, (err,res) => {
                if(err) reject(err);
                if(res) reject('Auth already exists');
                let record = new AuthModel({
                    user_id: stringToObjectId(user_id),
                    username, type
                })
                record.save((err,res) => {
                    if(err) reject(err);
                    resolve(res);
                });
            })
        })
    }

    addComms(user_id, comms){
        return new Promise((resolve, reject)=>{
            UserModel.findOne({_id: user_id, is_active:true})
            .then(data=>{
                if(data){
                    addCommsWithoutUserIdCheck(user_id, comms)
                    .then(comms=>resolve(comms))
                    .catch(err => reject(err))
                } else {
                    reject('User does not exists')
                }
            })
            .catch(err => reject(err))
        })
    }

    authenticate({username,password},options={}) {
        /*
            Options:
                TokenvalidFor (Number): Duration JWT Token valid for.
            */
        if (!username || !password) {
            throw new Error('Username and password required');
        }

        let jwt_duration = this.options.jwt_duration;
        if(options.jwt_duration)
            jwt_duration = options.TokenvalidFor;

        return new Promise((resolve, reject)=>{
            this.getByUsername(username, {returnPwd:true})
            .then((user)=>
                Secure.hash(password, Buffer.from(user.password.salt, 'base64'))
                .then((hashedPwd)=>{
                    if (user.password.hash !== hashedPwd.hash.toString('base64')) 
                        reject('Invalid username or password');
                    user.password = undefined;
                    user.token = TokenUtil.generate({user_id: user.id, name: user.name}, jwt_duration);
                    resolve(user);
                })
            )
            .catch((err)=>{
                reject(err);
            })
        })
    };

    authExists({username}) {
        return new Promise((resolve, reject) => {
            AuthModel.findOne({username}, (err,res) => {
                if(err) reject(err);
                if(res) resolve(true);
                else resolve(false);
            })
        })
    };

    remove(user_id) {
        return new Promise((resolve, reject) => {
            AuthModel.deleteMany({user_id})
            .then(u=>CommModel.deleteMany({user_id}))
            .then(u=>UserModel.findOneAndDelete({_id:user_id}))
            .then(u=>resolve(true))
            .catch(e=>reject(e))
        })
    }

    create(payload, options={}) {
        var me = this;
        /*
        payload: User object. Must send either email or phone.
            extras (object): Store non-standard attributes with the user object.
        options:
            comms_verified (Boolean): Flag is_verified to true in comms record
        */
        if(typeof payload.name=='string')
            payload.name = NameParser.parse(payload.name)
        
        payload.auth = payload.auth || {};
        if(!payload.auth.username)
            throw new Error('Must send auth information');

        payload.password = payload.password || (Math.floor(100000 + Math.random() * 900000)).toString();
    
        var comms = payload.comms || [];
        if(payload.email){
            comms.push({
                type: 'email',
                address: payload.email,
                is_verified: options.comms_verified || false
            })
        }
        if(payload.phone){
            comms.push({
                type: 'phone',
                address: payload.phone,
                is_verified: options.comms_verified || false
            })
        }

        return new Promise((resolve, reject) => {   
            me.authExists(payload.auth)
            .then((exists)=>{if (exists) throw new Error('Username already exists')})
            .then(()=>Secure.saltAndHash(payload.password))
            .then((pwdHash) => {
                const user_record = new UserModel({
                    name: payload.name,
                    password: {
                        hash: pwdHash.hash.toString('base64'),
                        salt: pwdHash.salt.toString('base64')
                    },
                    extras: payload.extras
                })
                user_record.save()
                .then(user => me.addAuth(Object.assign({}, payload.auth, {user_id: user_record._id})))
                .then(auth => me.addComms(user_record._id, comms))
                .then(()=> me.getById(user_record._id))
                .then(user => resolve(user))
                .catch(err=> {
                    me.remove(user_record._id);
                    reject(err)
                })
            })
            .catch(err=>reject(err))
        });
    };

    createUsingEmail(payload, options={}) {
        /*
        Options:
            notify (Boolean): Send notifications through email.
        */
       if(!payload.email)
            throw new Error('Email is required');

        payload.auth = {username: payload.email, type:'email'}

        return new Promise((resolve, reject) => {
            this.create(payload,options)
            .then((user) => {
                if(options.notify){
                    const emailData = Object.assign({rawPassword: payload.password}, user);
                    this.sendMessage(payload.email, emailData, 'signup');
                }

                resolve(user);
            })
            .catch(err => reject(err))
        });
    };

    createUsingPhone(payload, options={}) {
        /*
            notify (Boolean): Send notifications through phone.
        */
       if(!payload.phone)
            throw new Error('Phone number is required');

        payload.auth = {username: payload.phone, type:'phone'}

        return new Promise((resolve, reject) => {
            this.create(payload,options)
            .then((user) => {
                if(options.notify){
                    //ToDo: code for sending phone confirmation
                }

                resolve(user);
            })
            .catch(err => reject(err))
        });
    }

    getById(user_id, options = {}) {
        /*
        Options:
            returnPwd (Boolean): Return password hash or not.
        */
        let showFields = {password: 0}
        if(options.returnPwd)
            showFields = {};
        options.returnPwd = options.returnPwd || false;
        return new Promise((resolve,reject)=>{
            UserModel.findOne({_id: user_id, is_active:true}, showFields, (err, user)=>{
                if(err) reject(err);
                if(user){
                    CommModel.find({user_id},(err, comms) => {
                        if(err) reject(err);
                        user.comms = comms
                        resolve(user);
                    })
                } else {
                    resolve(null);
                }
            })
        })
    }
    
    getByUsername(username, options) {
        /*
        Options:
            returnPwd (Boolean): Return password hash or not.
        */
        return new Promise((resolve, reject) => {
            AuthModel.findOne({username}, (err, auth) => {
                if (err) reject(err);
                if(auth){
                    this.getById(auth.user_id, options)
                    .then(data => resolve(data))
                    .error((err) => reject(err));
                }
                else
                    reject('Username does not exists');
            });
        });
    };
    
    getMe(token) {
        return new Promise((resolve, reject) => {
            TokenUtil.validate(token)
            .then(token_data=>this.getById(token_data.data.user_id))           
            .then(data => resolve(data))
            .catch(err => reject(err));
        });
    };     
}

module.exports = User