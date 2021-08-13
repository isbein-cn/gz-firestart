'use strict'

const Barrier = require('cb-barrier')
const ChildProcess = require('child_process')
const Fs = require('fs')
const Os = require('os')
const Path = require('path')
const Code = require('@hapi/code')
const Hoek = require('@hapi/hoek')
const Lab = require('@hapi/lab')
const Uf = require("unique-filename");

// Test shortcuts

const lab = exports.lab = Lab.script()
const describe = lab.describe
const it = lab.it
const expect = Code.expect

describe('bin/rejoice', () => {
  it('composes server with absolute path', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        host: 'localhost',
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

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const configPath = Uf(Os.tmpdir)
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))

    const hapi = ChildProcess.spawn(
      'node',
      [rejoice, '-c', configPath, '-p', modulePath]
    )

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.equal('loaded\n')
      hapi.kill()
      Fs.unlinkSync(configPath)
      barrier.pass()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })

    await barrier
  })

  it(
    'composes server with absolute path using symlink',
    { skip: process.platform === 'win32' },
    async () => {
      const barrier = new Barrier()
      const manifest = {
        server: {
          cache: 'catbox-memory',
          app: {
            my: 'special-value'
          },
          host: 'localhost',
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

      const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
      const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
      const modulePath = Path.join(__dirname, 'plugins')
      const symlinkPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')

      Fs.symlinkSync(modulePath, symlinkPath, 'dir')
      Fs.writeFileSync(configPath, JSON.stringify(manifest))

      const hapi = ChildProcess.spawn(
        'node',
        [rejoice, '-c', configPath, '-p', symlinkPath]
      )

      hapi.stdout.on('data', (data) => {
        expect(data.toString()).to.equal('loaded\n')
        hapi.kill()
        Fs.unlinkSync(configPath)
        Fs.unlinkSync(symlinkPath)
        barrier.pass()
      })

      hapi.stderr.on('data', (data) => {
        expect(data.toString()).to.not.exist()
      })
      await barrier
    }
  )

  it('composes server with preRegister callback', async () => {
    const barrier = new Barrier()
    const manifest = Fs.readFileSync(Path.join(__dirname, 'example', 'preRegister.js'), 'utf8')
    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'js')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, manifest, 'utf8')

    const hapi = ChildProcess.spawn(
      'node',
      [rejoice, '-c', configPath, '-p', modulePath]
    )

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.include('preRegister')
      hapi.kill()
      Fs.unlinkSync(configPath)
      barrier.pass()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })
    await barrier
  })

  it('fails when path cannot be resolved', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        port: 0,
        host: 'localhost'
      },
      register: {
        plugins: [
          {
            plugin: './--loaded'
          }
        ]
      }
    }

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))

    const hapi = ChildProcess.spawn('node', [rejoice, '-c', configPath, '-p', 'somethingWrong'])

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.include('ENOENT')
      hapi.kill()
      Fs.unlinkSync(configPath)
      barrier.pass()
    })

    await barrier
  })

  it('errors when it cannot require the extra module', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        port: 0,
        host: 'localhost'
      },
      register: {
        plugins: [
          {
            plugin: './--loaded'
          }
        ]
      }
    }

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const extraPath = 'somecoolmodule'
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))

    const hapi = ChildProcess.spawn('node', [rejoice, '-c', configPath, '-p', modulePath, '--require', extraPath])

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.include('Cannot find module')
      hapi.kill()
      Fs.unlinkSync(configPath)
      barrier.pass()
    })

    await barrier
  })

  it('errors when it cannot require the extra module from absolute path', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        host: 'localhost',
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

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const extraPath = Hoek.uniqueFilename(Os.tmpdir(), 'js')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))

    const hapi = ChildProcess.spawn('node', [rejoice, '-c', configPath, '-p', modulePath, '--require', extraPath])

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.include('Cannot find module')
      hapi.kill()
      Fs.unlinkSync(configPath)
      barrier.pass()
    })
    await barrier
  })

  it('loads extra modules as intended', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        port: 0,
        host: 'localhost'
      },
      register: {
        plugins: [
          {
            plugin: './--loaded'
          }
        ]
      }
    }

    const extra = 'console.log(\'test passed\')'
    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const extraPath = Hoek.uniqueFilename(Os.tmpdir(), 'js')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))
    Fs.writeFileSync(extraPath, extra)

    const hapi = ChildProcess.spawn('node', [rejoice, '-c', configPath, '-p', modulePath, '--require', extraPath])

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.equal('test passed\n')
      hapi.kill()
      Fs.unlinkSync(configPath)
      Fs.unlinkSync(extraPath)
      barrier.pass()
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })

    await barrier
  })

  it('loads multiple extra modules as intended', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: 'special-value'
        },
        port: 0,
        host: 'localhost'
      },
      register: {
        plugins: [
          {
            plugin: './--loaded'
          }
        ]
      }
    }

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')
    Fs.writeFileSync(configPath, JSON.stringify(manifest))
    const args = [rejoice, '-c', configPath, '-p', modulePath]
    const EXTRAS_TO_CREATE = 2
    const extraPaths = []

    for (let i = 0; i < EXTRAS_TO_CREATE; ++i) {
      const extraPath = Hoek.uniqueFilename(Os.tmpdir(), 'js')
      Fs.writeFileSync(extraPath, 'console.log(\'test ' + i + ' passed\')')
      args.push('--require')
      args.push(extraPath)
      extraPaths.push(extraPath)
    }

    const hapi = ChildProcess.spawn('node', args)
    let dataCount = 0

    hapi.stdout.on('data', (data) => {
      expect(data.toString()).to.equal('test ' + dataCount + ' passed\n')
      if (++dataCount === EXTRAS_TO_CREATE) {
        hapi.kill()
        Fs.unlinkSync(configPath)

        for (let i = 0; i < EXTRAS_TO_CREATE; ++i) {
          Fs.unlinkSync(extraPaths[i])
        }
        barrier.pass()
      }
    })

    hapi.stderr.on('data', (data) => {
      expect(data.toString()).to.not.exist()
    })
    await barrier
  })

  it('parses $prefixed values as environment variable values', async () => {
    const barrier = new Barrier()
    const manifest = {
      server: {
        cache: 'catbox-memory',
        app: {
          my: '$env.special_value'
        },
        host: '$env.host',
        port: '$env.port'
      },
      register: {
        plugins: [
          {
            plugin: './--options',
            options: {
              key: '$env.plugin_option'
            }
          }
        ]
      }
    }

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

    const configPath = Hoek.uniqueFilename(Os.tmpdir(), 'json')
    const rejoice = Path.join(__dirname, '..', 'bin', 'rejoice')
    const modulePath = Path.join(__dirname, 'plugins')

    Fs.writeFileSync(configPath, JSON.stringify(manifest))

    const hapi = ChildProcess.spawn('node', [rejoice, '-c', configPath, '-p', modulePath])

    hapi.stdout.setEncoding('utf8')
    hapi.stdout.on('data', (data) => {
      expect(data).to.equal('app.my: special-value, options.key: plugin-option\n')
      hapi.kill()
      Fs.unlinkSync(configPath)

      let restore = changes.pop()
      while (restore) {
        restore()
        restore = changes.pop()
      }

      barrier.pass()
    })

    hapi.stderr.setEncoding('utf8')
    hapi.stderr.on('data', (data) => {
      expect(data).to.not.exist()
    })
    await barrier
  })
})
