var handlebars = require('handlebars');
var fs = require('fs');
var kue = require('kue')
var queue = kue.createQueue();

var hash = require('./utils').hash;
var passwordSalt = require('./utils').passwordSalt;
var saltAndHash = require('./utils').saltAndHash;
var generateToken = require('./utils').generateToken;

const tokenExpiration = 24 * 7 * 1000 * 60 * 60;
const resetTokenExpiration = 24 * 1000* 60 * 60;

module.exports = (mongoose, mailer) => {

  var User = mongoose.model('User', mongoose.Schema({
    username: String,
    password: String,
    passwordSalt: String,
    token: String,
    tokenExpires: Number,
    resetToken: String,
    resetTokenExpires: Number,
    extras: mongoose.Schema.Types.Mixed,
    verified: {type: Boolean, default: false},
    verificationToken: String,
    verificationExpires: Number,
    createdAt: { type: Date, default: Date.now }
  }));

  queue.process('email', function(job, done){
    fs.readFile(job.data.html, {encoding: 'utf-8'}, function (err, html) {
      var template = handlebars.compile(html);
      var htmlToSend = template(job.data.data);
      job.data.html = htmlToSend;
      mailer.transporter.sendMail(job.data, (error, info) => {
        if(error) {
          console.log(error);
        }
        done();
      });
    });
  });

  return {
    userExists (username) {
      return new Promise((resolve, reject) => {
        User.findOne({
          username
        }, (err, data) => {
          if (err) {
            reject(err);
          }
          resolve(data);
        });
      });
    },

    createUser ({ username, password }, extras) {
      return this.userExists(username)
      .then((data) => {
        if(data) {
          return {
            data: null,
            error: [{
              field: 'email',
              message: 'User already exists'
            }]
          }
        } else {
          return saltAndHash(password).then((results) => {
            const user = new User({
              username: username,
              password: results.hash.toString('base64'),
              passwordSalt: results.salt.toString('base64'),
              extras: extras,
              token: null,
              tokenExpires: null,
              verificationToken: Math.random().toString(36).substring(7),
              verificationExpires: Date.now() + tokenExpiration
            });
            return new Promise((resolve, reject) => {
              user.save((err, data) => {
                if(err) {
                  reject({
                    error: err
                  })
                }

                // setup email data with unicode symbols
                let mailOptions = Object.assign(
                  mailer.options.signup,
                  {
                    data: data._doc,
                    to: username
                  }
                );

                queue.create('email', mailOptions)
                .removeOnComplete(true)
                .priority('high')
                .save((err) => {
                  resolve({
                    data: data,
                    error: false
                  });
                });
              });
            });
          });
        }
      })
    },

    authenticate ({ username, password }) {
      return this.userExists(username)
      .then((data) => {
        if(!data) {
          return {
            userExists: false,
            passwordsMatch: false,
            token: null
          }
        } else {
          return hash(password, new Buffer(data.passwordSalt, 'base64'))
          .then((hashedPassword) => {
            if(data.password !== hashedPassword.hash.toString('base64')) {
              return {
                userExists: true,
                passwordsMatch: false,
                token: null
              }
            } else {
              return generateToken().then((token) => {
                return new Promise((resolve, reject) => {
                  User.findOneAndUpdate({
                    username
                  }, { $set: {
                    token: token.toString('base64'),
                    tokenExpires: Date.now() + tokenExpiration
                  }}, { new: true },
                  (err, user) => {
                    if(err) reject(err);
                    resolve({
                      userExists: true,
                      passwordsMatch: true,
                      token: token.toString('base64'),
                      tokenExpires: Date.now() + tokenExpiration,
                      user: {
                        _id: user._id,
                        username: user.username,
                        extras: user.extras,
                        verified: user.verified
                      }
                    })
                  })
                })
              })
            }
          })
        }
      })
    },

    isTokenValid (token) {
      return new Promise((resolve, reject) => {
        User.findOne({ token }, function(err, item) {
          if (err) {
            reject(err);
          }
          resolve(!!item && item.tokenExpires >= Date.now());
        });
      })
    },

    isResetTokenValid (resetToken) {
      return new Promise((resolve, reject) => {
        User.findOne({ resetToken }, function(err, item) {
          if (err) {
            reject(err);
          }
          resolve(!!item && item.resetTokenExpires >= Date.now());
        });
      })
    },

    generateResetToken (username) {
      return this.userExists(username)
      .then((data) => {
        if(!data) {
          return {
            error: 'User not found'
          }
        } else {
          return generateToken().then((token) => {
            return new Promise((resolve, reject) => {
              User.findOneAndUpdate({
                username
              }, { $set: {
                resetToken: token.toString('base64').replace(/\//g, ''),
                resetTokenExpires: Date.now() + resetTokenExpiration
              }}, { new: true },
              (err, user) => {
                if(err) reject(err);

                // setup email data with unicode symbols
                let mailOptions = Object.assign(
                  mailer.options.forgot,
                  {
                    data: {
                      token: token.toString('base64').replace(/\//g, '')
                    },
                    to: username
                  }
                );

                queue.create('email', mailOptions)
                .removeOnComplete(true)
                .priority('high')
                .save((err) => {
                  resolve(true);
                });
              })
            })
          });
        }
      });
    },

    resetPassword (resetToken, password) {
      return saltAndHash(password).then((results) => {
        return new Promise((resolve, reject) => {
          User.findOneAndUpdate(
          { resetToken },
          { $set: {
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
    },

    changePassword (token, newPassword) {
      return saltAndHash(newPassword).then((results) => {
        return new Promise((resolve, reject) => {
          User.findOneAndUpdate(
          { token },
          { $set: {
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
    },

    requestVerification (userId) {
      return new Promise((resolve, reject) => {
        const verificationToken = Math.random().toString(36).substring(7);
        return User.findOneAndUpdate({
          _id: userId
        },
        {
          $set: {
            verificationToken,
            verificationExpires: Date.now() + tokenExpiration
          }
        }, { new: true }, (err, user) => {
          if(err) reject(err);
          resolve(true);

          let mailOptions = Object.assign(
            mailer.options.verify,
            {
              data: {
                verificationToken
              },
              to: user.username
            }
          );
          queue.create('email', mailOptions)
          .removeOnComplete(true)
          .priority('high')
          .save((err) => {
            resolve(true);
          });
        })
      })
    },

    verifyAccount (verificationToken) {
      return new Promise((resolve, reject) => {
        User.findOne({ verificationToken }, function(err, item) {
          if (err) {
            reject(err);
          }
          if(!!item && item.verificationExpires >= Date.now()) {
            return User.findOneAndUpdate({ verificationToken }, {
              $set : {
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
