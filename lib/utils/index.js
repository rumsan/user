const Secure = require("./secure");
const TokenUtil = require("./token");
const { Error, ERR } = require("./error");
const NameParser = require("./nameParser");

module.exports = { Secure, TokenUtil, NameParser, Error, ERR };

/*
= coroutine(function*(){

})

new Promise((resolve,reject)=>{

})

(err, d) => {

}
*/
