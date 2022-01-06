/*
#***********************************************
#
#      Filename: gz-firestart/test/example/preRegister.js
#
#        Author: wwj - 318348750@qq.com
#       Company: 甘肃国臻物联网科技有限公司
#   Description: xxx
#        Create: 2022-01-05 15:21:00
# Last Modified: 2022-01-05 15:21:26
#***********************************************
*/
'use strict'

module.exports = {
  server: {
    host: 'localhost',
    port: 0
  },
  register: {
    plugins: [
      {
        plugin: './--loaded'
      }
    ]
  },
  preRegister: function (server) {
    console.log('Inside `preRegister` function.')
  }
}
