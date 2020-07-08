const arrayContainsArray = (superset, subset) => {
  if (subset.length === 0 || superset.length < subset.length) {
    return false;
  }
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < subset.length; i++) {
    if (superset.indexOf(subset[i]) > -1) return true;
  }
  return false;
};

module.exports = {
  hasPermission: (permsToCheck, permissionList) => {
    try {
      if (typeof permsToCheck === 'string') permsToCheck = permsToCheck.split(',');
      return arrayContainsArray(permissionList, permsToCheck);
    } catch (e) {
      return false;
    }
  },
};
