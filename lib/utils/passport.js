const config = require('config');

// TODO check this eslint
// eslint-disable-next-line consistent-return
const checkDomains = (domain, done) => {
  if (config.has('auth.allowedDomains')) {
    const allowedDomains = config.get('auth.allowedDomains');
    if (!allowedDomains.includes(domain)) {
      return done(null, false, {
        message: config.has('auth.allowedDomainsErrorMsg')
          ? config.get('auth.allowedDomainsErrorMsg')
          : 'Your email domain is not allowed to login. Please check with administrator.',
      });
    }
  }
};

module.exports = (passport, UserController, { FacebookStrategy, GoogleStrategy }) => {
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  if (FacebookStrategy) {
    if (!config.has('services.facebook')) throw Error('Must have service.facebook config.');
    let facebookCallback = '/auth/facebook/callback';
    if (config.has('services.facebook.callback')) facebookCallback = config.get('services.facebook.callback');

    passport.use(
      new FacebookStrategy(
        {
          clientID: config.get('services.facebook.key'),
          clientSecret: config.get('services.facebook.secret'),
          callbackURL: config.get('app.url') + facebookCallback,
          passReqToCallback: true,
          profileFields: [
            'id',
            'emails',
            'name',
            'displayName',
            'gender',
            'birthday',
            'picture.type(large)',
          ],
        },
        ((req, token, refreshToken, profile, done) => {
          process.nextTick(() => {
            const pData = profile._json;
            const data = {
              service: 'facebook',
              service_id: pData.id,
              extras: Object.assign(pData, {
                imageUrl: pData.picture.data.url,
              }),
            };
            checkDomains(pData.email, done);

            UserController.loginExternal(data).then((d) => done(null, d));
          });
        }),
      ),
    );
  }

  if (GoogleStrategy) {
    if (!config.has('services.google')) throw Error('Must have service.google config.');
    let googleCallback = '/auth/google/callback';
    if (config.has('services.google.callback')) googleCallback = config.get('services.google.callback');
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.get('services.google.key'),
          clientSecret: config.get('services.google.secret'),
          callbackURL: config.get('app.url') + googleCallback,
          passReqToCallback: true,
        },
        ((req, token, refreshToken, profile, done) => {
          process.nextTick(() => {
            const pData = profile._json;
            const data = {
              service: 'google',
              service_id: profile.id,
              data: {
                name: pData.name,
                email: pData.email,
                gender: pData.gender,
                picture: pData.picture,
                phone: Math.floor(Math.random() * 9000000000),
                social_data: pData,
              },
            };
            checkDomains(pData.hd, done);

            UserController.loginExternal(data)
              .then((d) => done(null, d))
              .catch((e) => done(null, false, { message: e.message }));
          });
        }),
      ),
    );
  }
};
