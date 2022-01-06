/*
#***********************************************
#
#      Filename: gz-firestart/test/gz-firestart.js
#
#        Author: wwj - 318348750@qq.com
#       Company: 甘肃国臻物联网科技有限公司
#   Description: xxx
#        Create: 2022-01-05 16:13:56
# Last Modified: 2022-01-06 13:45:18
#***********************************************
*/
'use strict'

const Fs = require('fs')
const Os = require('os')
const Path = require('path')

const Code = require('@hapi/code')
const Glue = require('@hapi/glue')
const Hoek = require('@hapi/hoek')
const Lab = require('@hapi/lab')
const FireStarter = require('..')
const Uf = require('unique-filename')

// Test shortcuts

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const expect = Code.expect

process.on('unhandledRejection', (err) => {
  process.stdout.write(err.toString())
  process.stdout.write(err.stack)
  process.exit(1)
})

describe('start()', () => {
  const manifestFile = {
    server: {
      // cache: 'catbox-memory',
      app: {
        my: 'special-value'
      },
      port: 0
    },
    register: {
      plugins: [
        {
          plugin: './--loaded'
        }
      ]
    }
  }

  it('使用绝对地址配置文件启动服务', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))
    const compose = Glue.compose

    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.register.plugins[0]).to.exist()
      expect(manifest.server).to.exist()
      expect(packOptions.relativeTo).to.be.a.string()
      const server = await compose(manifest, packOptions)
      expect(server).to.exist()

      server.start = function () {
        Glue.compose = compose
        Fs.unlinkSync(configPath)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })

  it('启动服务增加额外模块', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    const extraPath = Uf(Os.tmpdir()) + '.js'
    const extra = 'console.log(\'test passed\')'

    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))
    Fs.writeFileSync(extraPath, extra)

    const compose = Glue.compose
    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.register.plugins[0]).to.exist()
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      packOptions.relativeTo = modulePath
      const server = await compose(manifest, packOptions)
      expect(server).to.exist()

      server.start = function () {
        Glue.compose = compose
        Fs.unlinkSync(extraPath)
        Fs.unlinkSync(configPath)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '--require', extraPath]
    })
  })

  it('使用 --p 选线 模块路径绝对路径', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))
    const compose = Glue.compose
    const realpathSync = Fs.realpathSync
    const consoleError = console.error

    console.error = function (value) {
      expect(value).to.not.exist()
    }

    Fs.realpathSync = function () {
      Fs.realpathSync = realpathSync
      return process.cwd()
    }

    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.register.plugins[0]).to.exist()
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      const server = await compose(manifest, packOptions)

      expect(server).to.exist()

      server.start = function () {
        Glue.compose = compose
        console.error = consoleError
        Fs.unlinkSync(configPath)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath, '--require', 'yallist']
    })
  })

  it('使用 --p 选项  模块路径相对路径', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))

    const compose = Glue.compose
    const realpathSync = Fs.realpathSync
    const consoleError = console.error

    console.error = function (value) {
      process.stdout.write(value.toString())
      expect(value).to.not.exist()
    }

    Fs.realpathSync = function () {
      Fs.realpathSync = realpathSync
      return process.cwd()
    }

    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.register.plugins[0]).to.exist()
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      const server = await compose(manifest, packOptions)
      expect(server).to.exist()
      server.start = function () {
        Glue.compose = compose
        console.error = consoleError
        Fs.unlinkSync(configPath)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath, '--require', './node_modules/yallist']
    })
  })

  it('模块无法加载 退出', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))
    const exit = process.exit
    const consoleError = console.error

    console.error = function (string, path) {
      expect(string).to.equal('无法加载模块: %s (%s)')
      expect(path).to.equal('/foo/bar')
    }

    process.exit = function (value) {
      process.exit = exit
      expect(value).to.equal(1)
      console.error = consoleError
      Fs.unlinkSync(configPath)
    }

    await FireStarter.start({
      args: ['-c', configPath, '--require', '/foo/bar']
    })
  })

  it('相对路径加载manifest', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const m = Hoek.clone(manifestFile)
    m.register = {}
    Fs.writeFileSync(configPath, JSON.stringify(m))
    const relativePath = Path.relative(process.cwd(), configPath)
    const compose = Glue.compose
    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()
      const server = await compose(manifest, packOptions)
      expect(server).to.exist()

      server.start = function () {
        Glue.compose = compose
        Fs.unlinkSync(configPath)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', relativePath]
    })
  })

  it('manifest 无法解析 退出', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    Fs.writeFileSync(configPath, JSON.stringify(manifestFile) + ']]')
    const exit = process.exit
    const consoleError = console.error
    console.error = function (value) {
      expect(value).to.match(/Failed loading configuration file: /)
    }

    process.exit = function (value) {
      process.exit = exit
      expect(value).to.equal(1)
      console.error = consoleError
      Fs.unlinkSync(configPath)
    }

    await FireStarter.start({
      args: ['-c', configPath]
    })
  })

  it('使用 -p 选项加载 失败', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    Fs.writeFileSync(configPath, JSON.stringify(manifestFile))
    const realpath = Fs.realpath
    const consoleError = console.error
    const exit = process.exit

    console.error = function (value) {
      expect(value.message).to.equal('mock error')
    }

    process.exit = function (value) {
      process.exit = exit
      expect(value).to.equal(1)
      console.error = consoleError
      Fs.unlinkSync(configPath)
    }

    Fs.realpath = function (path, callback) {
      expect(path).to.equal(modulePath)
      Fs.realpath = realpath
      callback(new Error('mock error'))
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })

  it('编译 $prefixed 的值', async () => {
    const m = Hoek.clone(manifestFile)

    m.server = {
      host: '$env.host',
      port: '$env.port',
      app: {
        my: '$env.undefined'
      }
    }
    m.register = {
      plugins: [
        {
          plugin: './--options',
          options: {
            key: '$env.plugin_option'
          }
        }
      ]
    }
    m.server.app.my = '$env.special_value'

    const changes = []
    const setEnv = function (key, value) {
      const previous = process.env[key]

      if (typeof value === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = value
      }

      return setEnv.bind(null, key, previous)
    }

    changes.push(setEnv('host', 'localhost'))
    changes.push(setEnv('plugin_option', 'plugin-option'))
    changes.push(setEnv('port', 0))
    changes.push(setEnv('special_value', 'special-value'))
    // Ensure that the 'undefined' environment variable is *not* set.
    changes.push(setEnv('undefined'))
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    Fs.writeFileSync(configPath, JSON.stringify(m))

    const compose = Glue.compose
    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.server.port).to.equal('0')
      expect(manifest.server.host).to.equal('localhost')
      expect(manifest.register.plugins[0].options).to.equal({
        key: 'plugin-option'
      })
      expect(manifest.server.app).to.equal({
        my: 'special-value'
      })

      const server = await compose(manifest, packOptions)

      expect(server).to.exist()

      server.start = function () {
        Glue.compose = compose
        Fs.unlinkSync(configPath)

        // Put the env variables back
        let restore = changes.pop()
        while (restore) {
          restore()
          restore = changes.pop()
        }
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })

  it('参数无效退出进程', async () => {
    const consoleError = console.error
    const exit = process.exit

    console.error = function (value) {
      expect(value).to.match(/gz-firestart -c manifest.json [-p node_modules_path -r pre_load_module]/)
    }

    process.exit = function (code) {
      process.exit = exit
      expect(code).to.equal(1)
      console.error = consoleError
    }

    await FireStarter.start({
      args: []
    })
  })

  it('-h 输出帮助信息', async () => {
    const exit = process.exit

    console.log = function (value) {
      expect(value).to.match(/gz-firestart -c manifest.json [-p node_modules_path -r pre_load_module]/)
    }

    process.exit = function (code) {
      process.exit = exit
      expect(code).to.equal(1)
      console.log = Hoek.ignore
    }

    await FireStarter.start({
      args: ['-h', '-c', 'foo.json']
    })
  })

  it('加载插件有错误抛出错误', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    const m = Hoek.clone(manifestFile)
    Fs.writeFileSync(configPath, JSON.stringify(m))

    const compose = Glue.compose
    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      const server = await compose(manifest, packOptions)
      expect(server).to.exist()
      expect(() => {
        throw new Error('mock error')
      }).to.throw(Error, /mock error/)

      Glue.compose = compose
      Fs.unlinkSync(configPath)
      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })

  it('启动服务有错抛出错误', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    const m = Hoek.clone(manifestFile)

    Fs.writeFileSync(configPath, JSON.stringify(m))

    const compose = Glue.compose
    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      const server = await compose(manifest, packOptions)
      expect(server).to.exist()
      server.start = function (cb) {
        Glue.compose = compose
        Fs.unlinkSync(configPath)
        expect(() => {
          throw new Error('mock error')
        }).to.throw(Error, /mock error/)
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })

  it('kills the process on SIGQUIT and restarts on SIGUSR2', async () => {
    const configPath = Uf(Os.tmpdir()) + '.json'
    const modulePath = Path.join(__dirname, 'plugins')
    const m = Hoek.clone(manifestFile)

    Fs.writeFileSync(configPath, JSON.stringify(m))

    const compose = Glue.compose
    const exit = process.exit
    const start = FireStarter.start

    // There are many of these already attached
    process.removeAllListeners('SIGUSR2')
    process.removeAllListeners('SIGQUIT')

    Glue.compose = async function (manifest, packOptions) {
      expect(manifest.server).to.exist()
      expect(packOptions).to.exist()

      const server = await compose(manifest, packOptions)
      expect(server).to.exist()
      server.stop = Hoek.ignore
      server.start = function (cbStart) {
        Glue.compose = compose
        Fs.unlinkSync(configPath)

        process.exit = function (value) {
          process.exit = exit
          expect(value).to.equal(0)
        }

        FireStarter.start = function (options) {
          FireStarter.start = start
          expect(options).to.equal({
            args: ['-c', configPath, '-p', modulePath]
          })
        }

        process.emit('SIGQUIT')
        process.emit('SIGUSR2')
      }

      return server
    }

    await FireStarter.start({
      args: ['-c', configPath, '-p', modulePath]
    })
  })
})
