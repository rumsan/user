const Secure = require("./secure");
const TokenUtil = require("./token");
const RoleUtil = require("./role");
const { Error, ERR } = require("./error");
const NameParser = require("./nameParser");
const pwd = require("./pwd");

module.exports = {
  Secure,
  TokenUtil,
  NameParser,
  Error,
  ERR,
  RoleUtil,
  SecureUtil: Secure,
  pwd,
};

/*
= coroutine(function*(){

})

new Promise((resolve,reject)=>{

})

(err, d) => {

}
*/
