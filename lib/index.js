/* eslint-disable global-require */
module.exports = {
  PassportJS: require('./utils/passport'),
  TokenUtil: require('./utils/token'),
  RoleUtil: require('./utils/role'),
  AuthRoutes: require('./utils/routes'),
  User: require('./user'),
  Role: require('./role'),
};
