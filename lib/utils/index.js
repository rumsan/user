const Secure = require("./secure");
const TokenUtil = require("./token");
const RoleUtil = require("./role");
const { Error, ERR } = require("./error");
const NameParser = require("./nameParser");

module.exports = { Secure, TokenUtil, NameParser, Error, ERR, RoleUtil };

/*
= coroutine(function*(){

})

new Promise((resolve,reject)=>{

})

(err, d) => {

}
*/
