const config = require('config');

module.exports = ({
  UserController, router, passport, TokenUtil, PrivateKey,
}) => {
  router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Login' });
  });

  router.post('/login', async (req, res, next) => {
    try {
      const auth = await UserController.login(req.body);
      const redirectUrl = req.query.redirect_uri || '/passport-control';
      res.redirect(`${redirectUrl}?token=${auth.access_token}`);
    } catch (e) {
      next(e);
    }
  });

  router.get('/auth', async (req, res, next) => {
    try {
      const token = req.query.access_token || req.headers.access_token || req.cookies.access_token;
      const { user, permissions } = await UserController.validateToken(token);
      res.json({
        user,
        access_token: token,
        permissions,
      });
    } catch (e) {
      next(e);
    }
  });

  router.post('/auth', async (req, res, next) => {
    try {
      let payload = PrivateKey.decrypt(req.body.loginData, 'utf8');
      payload = JSON.parse(payload);

      // Expire signature in 5 minutes
      const now = new Date();
      const old = new Date(payload.serverTime);
      const diffMs = (now - old);
      const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
      if (diffMins > 4) throw Error('Login signature has expired.');

      const { user, accessToken } = await UserController.authenticate(payload);
      res.json({ user, accessToken });
    } catch (e) {
      next(e);
    }
  });

  router.get('/auth/publickey', async (req, res) => {
    res.json({ key: config.get('app.pubic_key'), serverTime: new Date() });
  });

  router.get('/logout', (req, res) => {
    res.clearCookie('access_token');
    res.clearCookie('redirect_url');
    res.redirect('/login');
  });

  router.get('/register', (req, res) => {
    res.render('auth/register', { title: 'Register' });
  });

  router.get('/passport-control', async (req, res) => {
    try {
      const tokenData = await TokenUtil.validate(req.query.token);
      res.cookie('access_token', req.query.token);
      res.render('auth/passport-control', {
        title: 'Passport Control',
        access_token: req.query.token,
        redirect_url: req.cookies.redirect_url,
        user_fname: tokenData.data.name_first,
        user_name: tokenData.data.name,
      });
    } catch (e) {
      res.clearCookie('access_token');
      res.redirect('/login');
    }
  });

  if (config.has('auth.services')) {
    const authServices = config.get('auth.services');
    // eslint-disable-next-line array-callback-return
    authServices.map((as) => {
      let scope = ['email'];
      if (as === 'google') scope.push('profile');
      if (config.has(`services.${as}.scope`)) {
        const cfgScope = config.get(`services.${as}.scope`);
        scope = [...new Set([...cfgScope, ...scope])];
      }

      router.get(`/auth/${as}`, (req, res, next) => {
        passport.authenticate(as, {
          scope,
          state: req.query.state || 'redirect:/passport-control',
        })(req, res, next);
      });
    });
  }

  router.get('/auth/:strategy', (req, res) => {
    res.send(`Auth strategy [${req.params.strategy}] is not enabled.`);
  });

  function __promisifiedPassportAuthentication(strategy, req, res) {
    return new Promise((resolve, reject) => {
      passport.authenticate(strategy, { session: false }, (err, user, details) => {
        if (err) reject(new Error(err));
        else if (!user) reject(details.message);
        resolve(user);
      })(req, res);
    });
  }

  router.get('/auth/:strategy/callback', async (req, res) => {
    __promisifiedPassportAuthentication(req.params.strategy, req, res)
      .then(async (auth) => {
        const authState = req.query.state;
        if (authState) {
          const action = authState.substr(0, authState.indexOf(':'));
          const data = authState.substr(authState.indexOf(':') + 1);

          if (action === 'connect-key') await UserController.setPublicKey(auth.user._id, data);
          if (action === 'redirect') {
            res.redirect(`${data}?token=${auth.access_token}`);
            return;
          }
        }

        res.redirect(`/passport-control?token=${auth.access_token}`);
      })
      .catch((e) => {
        res.render('misc/message', {
          message: e,
        });
      });
  });
};
