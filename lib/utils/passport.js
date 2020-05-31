const config = require("config");

module.exports = (passport, UserController, { FacebookStrategy, GoogleStrategy }) => {
  passport.serializeUser(function (user, done) {
    done(null, user);
  });
  passport.deserializeUser(function (obj, done) {
    done(null, obj);
  });

  if (FacebookStrategy) {
    if (!config.has("services.facebook")) throw Error("Must have service.facebook config.");

    passport.use(
      new FacebookStrategy(
        {
          clientID: config.get("services.facebook.key"),
          clientSecret: config.get("services.facebook.secret"),
          callbackURL: config.get("app.url") + config.get("services.facebook.callback"),
          passReqToCallback: true,
          profileFields: [
            "id",
            "emails",
            "name",
            "displayName",
            "gender",
            "birthday",
            "picture.type(large)"
          ]
        },
        function (req, token, refreshToken, profile, done) {
          process.nextTick(function () {
            let pData = profile._json;
            let data = {
              service: "facebook",
              service_id: pData.id,
              extras: Object.assign(pData, {
                imageUrl: pData.picture.data.url
              })
            };
            checkDomains(pData.email, done);

            UserController.loginExternal(data).then(d => {
              return done(null, d);
            });
          });
        }
      )
    );
  }

  if (GoogleStrategy) {
    if (!config.has("services.google")) throw Error("Must have service.google config.");

    passport.use(
      new GoogleStrategy(
        {
          clientID: config.get("services.google.key"),
          clientSecret: config.get("services.google.secret"),
          callbackURL: config.get("app.url") + config.get("services.google.callback"),
          passReqToCallback: true
        },
        function (req, token, refreshToken, profile, done) {
          process.nextTick(function () {
            let pData = profile._json;
            let data = {
              service: "google",
              service_id: profile.id,
              data: {
                name: pData.name,
                email: pData.email,
                gender: pData.gender,
                picture: pData.picture,
                social_data: pData
              }
            };
            checkDomains(pData.hd, done);

            UserController.loginExternal(data)
              .then(d => {
                return done(null, d);
              })
              .catch(e => {
                return done(null, false, { message: e.message });
              });
          });
        }
      )
    );
  }
};

const checkDomains = (domain, done) => {
  if (config.has("auth.allowedDomains")) {
    let allowedDomains = config.get("auth.allowedDomains");
    if (!allowedDomains.includes(domain))
      return done(null, false, {
        message: config.has("auth.allowedDomainsErrorMsg")
          ? config.get("auth.allowedDomainsErrorMsg")
          : "Your email domain is not allowed to login. Please check with administrator."
      });
  }
};
