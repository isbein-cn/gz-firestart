'use strict'

// Plugin registration
const register = function (server, options) {
  console.log('loaded')
}

module.exports = {
  pkg: require('../package.json'),
  register
}
