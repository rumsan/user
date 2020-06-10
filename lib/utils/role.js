const config = require("config");
const { ERR } = require("./error");

const arrayContainsArray = (superset, subset) => {
  if (0 === subset.length || superset.length < subset.length) {
    return false;
  }
  for (var i = 0; i < subset.length; i++) {
    if (superset.indexOf(subset[i]) > -1) return true;
  }
  return false;
};

module.exports = {
  hasPermission: (permsToCheck, permissionList) => {
    try {
      if (typeof permsToCheck == "string") permsToCheck = permsToCheck.split(",");
      return arrayContainsArray(permissionList, permsToCheck);
    } catch (e) {
      return false;
    }
  }
};
