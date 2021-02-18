class RSError extends Error {
  constructor(message, name, httpCode) {
    super();
    this.message = message;
    this.data = {
      group: "rsuser",
      type: "rserror",
      message,
      name: name || null,
      httpCode: httpCode || 500,
    };
    this.status = httpCode || 500;
    this.className = this.constructor.name;
    this.stack = new Error(message).stack;
  }
}

const ERR = {
  DEFAULT: new RSError("Error Occured", "none", 500),

  APP_SECRET: new RSError("AppSecret is undefined.", "app_secret", 500),
  APP_SECRET32: new RSError(
    "AppSecret must be 32 characters long.",
    "app_secret32",
    500
  ),
  AUTH_EXISTS: new RSError("User auth already exists.", "auth_exists", 400),
  AUTH_REQ: new RSError(
    'Must send auth data. eg: {type:"email","username":"santosh@rumsan.com"}',
    "auth_req",
    400
  ),
  EMAIL_REQ: new RSError("Email is required.", "email_req", 400),
  MONGOOSE: new RSError("Mongoose is undefined.", "mongoose", 500),
  NAME_REQ: new RSError("Name is required.", "name_req", 400),
  NOT_IMPLEMENTED: new RSError(
    "This function is not implemented in rs-user yet. Please over-write it yourself",
    "not_implemented",
    400
  ),
  LOGIN_INVALID: new RSError(
    "Invalid username or password",
    "login_invalid",
    401
  ),
  LOGIN_REQ: new RSError(
    "Username and password are required.",
    "password_req",
    400
  ),
  PASSWORD_REQ: new RSError("Password is required.", "password_req", 400),
  PWD_SAME: new RSError("Old Password and New Password must be different", 400),
  PWD_NOTMATCH: new RSError("Password is invalid", 400),
  PHONE_REQ: new RSError("Phone is required", "phone_req", 400),
  ROLE_NOEXISTS: new RSError("Role does not exist", "role_noexists", 400),
  TOKEN_INVALID: new RSError(
    "Token is invalid or expired. Please get a new one.",
    "token_invalid",
    401
  ),
  USER_NOEXISTS: new RSError("User does not exists", "user_noexists", 400),
  USERID_REQ: new RSError("user_id is required", "userid_req", 400),
  USERNAME_EXISTS: new RSError(
    "Username already exists.",
    "username_exists",
    400
  ),
  EMAIL_NOEXISTS: new RSError("Email does not exists.", "email_noexists", 400),
  PHONE_NOEXISTS: new RSError("Phone does not exists.", "phone_noexists", 400),
  USERNAME_REQ: new RSError("Username is required.", "username_req", 400),

  // APP_SECRET: new RSError('', '', 400),
};

const throwError = (err) => {
  throw err;
};
module.exports = { Error: RSError, ERR, throwError };
