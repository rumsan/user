var handlebars = require('handlebars');
var fs = require('fs');
var jwt = require('jsonwebtoken');

var hash = require('./utils').hash;
var passwordSalt = require('./utils').passwordSalt;
var saltAndHash = require('./utils').saltAndHash;
var generateRandomToken = require('./utils').generateToken;
var JWT_SECRET = require('./utils').JWT_SECRET;

const tokenExpiration = 24 * 7 * 1000 * 60 * 60;
const resetTokenExpiration = 24 * 1000 * 60 * 60;
const tokenExpireBalancer = 3 * 1000;

module.exports = (mongoose, mailer) => {

  var UserSchema = mongoose.Schema({
    username: String,
    password: String,
    passwordSalt: String,
    token: String,
    tokenExpires: Number,
    resetToken: String,
    resetTokenExpires: Number,
    extras: mongoose.Schema.Types.Mixed,
    verified: { type: Boolean, default: false },
    verificationToken: String,
    verificationExpires: Number,
    createdAt: { type: Date, default: Date.now }
  });

  var User = mongoose.model('User', UserSchema);

  const sendMessage = (to, data, userType) => {
    // setup email data with unicode symbols
    const mailOptions = Object.assign({},
      mailer.options[userType],
      {
        data,
        to
      }
    );

    return new Promise((resolve, reject) => {
      fs.readFile(mailOptions.html, { encoding: 'utf-8' }, function (err, html) {
        if (err) reject(err);
        var template = handlebars.compile(html);
        var htmlToSend = template(data);
        mailOptions.html = htmlToSend;

        if (data.subject) {
          mailOptions.subject = data.subject;
        }

        mailer.transporter.sendMail(mailOptions);
        resolve(true);
      });
    });
  };

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

    generateToken (data) {
      return jwt.sign({
        data: {
          _id: data._id,
          extras: {
            role: data.extras.role
          }
        }
      }, JWT_SECRET, { expiresIn: tokenExpiration });
    },

    createUser ({ username, password }, extras) {
      if (!username || !password) {
        throw new Error('Username and password required');
      }
      return this.userExists(username)
      .then((data) => {
        if (data) {
          throw new Error('Email already exists');
        }
        return saltAndHash(password).then((results) => {
          const user = new User({
            username: username,
            password: results.hash.toString('base64'),
            passwordSalt: results.salt.toString('base64'),
            extras,
            token: null,
            tokenExpires: null,
            verificationToken: Math.random().toString(36).substring(7),
            verificationExpires: Date.now() + tokenExpiration - tokenExpireBalancer
          });
          return user;
        });
      })
      .then((user) => {
        return new Promise((resolve, reject) => {
          user.save((err, data) => {
            if(err) {
              reject(err);
            }
            const emailData = Object.assign({}, data._doc);
            emailData.extras.rawPassword = password;
            // setup email data with unicode symbols

            sendMessage(username, data._doc, 'signup');
            resolve(data);
          });
        });
      }).catch((e) => {
        throw e
      });
    },

    authenticate ({ username, password }) {
      if (!username || !password) {
        throw new Error('Username and password required');
      }
      return this.userExists(username)
      .then((data) => {
        if(!data) {
          throw new Error('User not found');
        }
        return hash(password, new Buffer(data.passwordSalt, 'base64'))
        .then((hashedPassword) => {
          if(data.password !== hashedPassword.hash.toString('base64')) {
            throw new Error('Invalid username or password');
          } else {
            return data;
          }
        })
      })
      .then((user) => this.generateToken(user))
      .then((token) => {
        return new Promise((resolve, reject) => {
          User.findOneAndUpdate({
            username
          }, { $set: {
            token: token.toString('base64'),
            tokenExpires: Date.now() + tokenExpiration - tokenExpireBalancer
          }}, { new: true },
          (err, user) => {
            if(err) reject(err);
            resolve(Object.assign(user,
            {
              _id: user._id,
              username: user.username,
              extras: user.extras,
              verified: user.verified,
              token: token.toString('base64'),
              tokenExpires: Date.now() + tokenExpiration - tokenExpireBalancer
            }));
          });
        });
      });
    },

    isTokenValid (token) {
      return new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
          if (err) {
            reject(err);
          }
          resolve(decoded ? decoded.data : false);
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
          return generateRandomToken().then((token) => {
            return new Promise((resolve, reject) => {
              User.findOneAndUpdate({
                username
              }, { $set: {
                resetToken: token.toString('base64').replace(/\//g, ''),
                resetTokenExpires: Date.now() + resetTokenExpiration
              }}, { new: true },
              (err, user) => {
                if(err) reject(err);

                sendMessage(username, {
                  token: token.toString('base64').replace(/\//g, '')
                }, 'forgot');
                resolve(true);
              })
            })
          });
        }
      });
    },

    resetPasswordByToken (resetToken, password) {
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

    changePasswordByToken (token, newPassword) {
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

    resetPassword (_id, newPassword) {
      return saltAndHash(newPassword).then((results) => {
        return new Promise((resolve, reject) => {
          User.findOneAndUpdate(
          { _id },
          { $set: {
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
              mailer.options.updatePassword,
              {
                data,
                to: item.username
              }
            );

            sendMessage(item.username, data, 'updatePassword');
            resolve(item);
          });
        })
      })
    },

    changePassword (_id, newPassword) {
      return saltAndHash(newPassword).then((results) => {
        return new Promise((resolve, reject) => {
          User.findOneAndUpdate(
          { _id },
          { $set: {
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
          sendMessage(user.username, { verificationToken }, 'verify');
          resolve(true);
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
    },

    getUserModel () {
      return User;
    },

    getUserSchema () {
      return UserSchema;
    }
  }
}
