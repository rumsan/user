const config = require("config");

module.exports = ({ UserController, router, passport, TokenUtil }) => {
  router.get("/login", (req, res, next) => {
    res.render("auth/login", { title: "Login" });
  });

  router.post("/login", async (req, res, next) => {
    try {
      let auth = await UserController.login(req.body);
      let redirectUrl = req.query.redirect_uri || "/passport-control";
      res.redirect(`${redirectUrl}?token=${auth.access_token}`);
    } catch (e) {
      next(e);
    }
  });

  router.get("/auth", async (req, res, next) => {
    try {
      const token =
        req.query.access_token || req.headers["access_token"] || req.cookies.access_token;
      let { user, permissions } = await UserController.validateToken(token);
      res.json({
        user,
        access_token: token,
        permissions
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/auth", async (req, res, next) => {
    try {
      let user = await UserController.login(req.body);
      let tokenData = await TokenUtil.validateToken(user.token);
      res.json({
        user,
        access_token: user.token,
        permissions: tokenData.data.permissions
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/logout", (req, res, next) => {
    res.clearCookie("access_token");
    res.clearCookie("redirect_url");
    res.redirect("/login");
  });

  router.get("/register", (req, res, next) => {
    res.render("auth/register", { title: "Register" });
  });

  router.get("/passport-control", async (req, res, next) => {
    try {
      let tokenData = await TokenUtil.validate(req.query.token);
      res.cookie("access_token", req.query.token);
      res.render("auth/passport-control", {
        title: "Passport Control",
        access_token: req.query.token,
        redirect_url: req.cookies.redirect_url,
        user_fname: tokenData.data.name_first,
        user_name: tokenData.data.name
      });
    } catch (e) {
      res.clearCookie("access_token");
      res.redirect("/login");
    }
  });

  if (config.has("auth.services")) {
    let authServices = config.get("auth.services");
    authServices.map(as => {
      router.get(`/auth/${as}`, (req, res, next) => {
        passport.authenticate(as, {
          scope: config.get(`services.${as}.scope`),
          state: req.query.redirect_uri || "/passport-control"
        })(req, res, next);
      });
    });
  }

  router.get("/auth/:strategy", (req, res) => {
    res.send(`Auth strategy [${req.params.strategy}] is not enabled.`);
  });

  router.get("/auth/:strategy/callback", async (req, res, next) => {
    __promisifiedPassportAuthentication(req.params.strategy, req, res)
      .then(auth => {
        res.redirect(`${req.query.state}?token=${auth.access_token}`);
      })
      .catch(e => {
        res.render("misc/message", {
          message: e
        });
      });
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
};
