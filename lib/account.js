const fs = require('fs');
const {coroutine} = require('bluebird');
const {Promise} = require('bluebird');
const _ = require('lodash');

const models = require('./models');
const utils = require('./utils');

const tokenExpiration = 24 * 7 * 1000 * 60 * 60;
const tokenExpireBalancer = 3 * 1000;

module.exports = ({mongoose, mailer, app_secret, options}) => {
    class Account{
        constructor(){}
        
        isResetTokenValid(resetToken) {
            return new Promise((resolve, reject) => {
                this.userStore.findOne({
                    resetToken
                }, function(err, item) {
                    if (err) {
                        reject(err);
                    }
                    resolve(!!item && item.resetTokenExpires >= Date.now());
                });
            })
        }

        generateResetToken(username) {
            return this.userExists(username)
                .then((data) => {
                    if (!data) {
                        return {
                            error: 'User not found'
                        }
                    } else {
                        return generateRandomToken().then((token) => {
                            return new Promise((resolve, reject) => {
                                this.userStore.findOneAndUpdate({
                                        username
                                    }, {
                                        $set: {
                                            resetToken: token.toString('base64').replace(/\//g, ''),
                                            resetTokenExpires: Date.now() + resetTokenExpiration
                                        }
                                    }, {
                                        new: true
                                    },
                                    (err, user) => {
                                        if (err) reject(err);

                                        this.sendMessage(username, {
                                            token: token.toString('base64').replace(/\//g, '')
                                        }, 'forgot');
                                        resolve(true);
                                    })
                            })
                        });
                    }
                });
        }

        resetPasswordByToken(resetToken, password) {
            return saltAndHash(password).then((results) => {
                return new Promise((resolve, reject) => {
                    this.userStore.findOneAndUpdate({
                            resetToken
                        }, {
                            $set: {
                                password: results.hash.toString('base64'),
                                passwordSalt: results.salt.toString('base64'),
                            },
                        },
                        function(err, item) {
                            if (err) {
                                reject(err);
                            }

                            resolve(true);
                        });
                })
            })
        }

        changePasswordByToken(token, newPassword) {
            return saltAndHash(newPassword).then((results) => {
                return new Promise((resolve, reject) => {
                    this.userStore.findOneAndUpdate({
                            token
                        }, {
                            $set: {
                                password: results.hash.toString('base64'),
                                passwordSalt: results.salt.toString('base64'),
                            },
                        },
                        function(err, item) {
                            if (err) {
                                reject(err);
                            }
                            resolve(true);
                        });
                })
            })
        }

        resetPassword(_id, newPassword) {
            return saltAndHash(newPassword).then((results) => {
                return new Promise((resolve, reject) => {
                    this.userStore.findOneAndUpdate({
                            _id
                        }, {
                            $set: {
                                password: results.hash.toString('base64'),
                                passwordSalt: results.salt.toString('base64'),
                            },
                        },
                        function(err, item) {
                            if (err) {
                                reject(err);
                            }

                            const data = Object.assign({}, item._doc);
                            data.extras.rawPassword = newPassword;
                            // setup email data with unicode symbols
                            let mailOptions = Object.assign(
                                mailer.options.updatePassword, {
                                    data,
                                    to: item.username
                                }
                            );

                            this.sendMessage(item.username, data, 'updatePassword');
                            resolve(item);
                        });
                })
            })
        }

        changePassword(_id, newPassword) {
            return saltAndHash(newPassword).then((results) => {
                return new Promise((resolve, reject) => {
                    this.userStore.findOneAndUpdate({
                            _id
                        }, {
                            $set: {
                                password: results.hash.toString('base64'),
                                passwordSalt: results.salt.toString('base64'),
                            },
                        },
                        function(err, item) {
                            if (err) {
                                reject(err);
                            }
                            resolve(item);
                        });
                })
            })
        }

        requestVerification(userId) {
            return new Promise((resolve, reject) => {
                const verificationToken = Math.random().toString(36).substring(7);
                return this.userStore.findOneAndUpdate({
                    _id: userId
                }, {
                    $set: {
                        verificationToken,
                        verificationExpires: Date.now() + tokenExpiration
                    }
                }, {
                    new: true
                }, (err, user) => {
                    if (err) reject(err);
                    this.sendMessage(user.username, {
                        verificationToken
                    }, 'verify');
                    resolve(true);
                })
            })
        }

        verifyAccount(verificationToken) {
            return new Promise((resolve, reject) => {
                this.userStore.findOne({
                    verificationToken
                }, function(err, item) {
                    if (err) {
                        reject(err);
                    }
                    if (!!item && item.verificationExpires >= Date.now()) {
                        return this.userStore.findOneAndUpdate({
                            verificationToken
                        }, {
                            $set: {
                                verified: true,
                                verificationToken: null,
                                verificationExpires: null
                            }
                        }, function(err) {
                            if (err) {
                                reject(err);
                            }
                            resolve(true);
                        });
                    } else {
                        resolve(false);
                    }
                });
            })
        }
    }
}