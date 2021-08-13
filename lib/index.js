/*
#***********************************************
#
#      Filename: gz-firestarter/lib/index.js
#
#        Author: wwj - 318348750@qq.com
#       Company: 甘肃国臻物联网科技有限公司
#   Description: hapjs 框架 带配置启动CLI
#        Create: 2021-08-08 11:24:49
# Last Modified: 2021-08-08 11:24:49
#***********************************************
*/
'use strict'

const Bossy = require('@hapi/bossy')
const Fs = require('fs')
const Path = require('path')
const Util = require('util')
const Glue = require('@hapi/glue')
const DotEnv = require('dotenv')

// Declare internals

const internals = {}

internals.definition = {
  c: {
    description: 'Manifest JSON配置文件路径',
    require: true
  },
  p: {
    description: 'node_modules 路径，默认为项目根路径',
    default: process.cwd()
  },
  r: {
    alias: 'require',
    description: '应用启动前加载模块路径',
    multiple: true
  },
  e: {
    alias: 'dotenv',
    description: '加载并解析.env环境变量文件'
  },
  h: {
    alias: 'help',
    description: '显示帮助信息',
    type: 'boolean'
  }
}

/**
 * 加载模块
 * @param {Array<>} args 命令行参数
 * @return {Object} err 加载错误时返回错误信息对象
 */
internals.loadExtras = (args) => {
  const extras = args.require
  if (!extras) {
    return
  }
  let extrasPath
  const nodeModulesPath = Path.join(
    args.p ? Fs.realpathSync(args.p) : process.cwd(),
    'node_modules'
  )

  for (let i = 0; i < extras.length; ++i) {
    const extra = extras[i]
    if (!Path.isAbsolute(extra)) {
      if (extra[0] === '.') {
        extrasPath = Path.join(process.cwd(), extra)
      } else {
        extrasPath = Path.join(nodeModulesPath, extra)
      }
    } else {
      extrasPath = extra
    }

    try {
      require(extrasPath)
    } catch (err) {
      console.error('无法加载模块: %s (%s)', extra, err.message)
      return err
    }
  }
}

/**
 * 加载配置文件
 * @param {Array<>} args 命令行参数
 * @return {Object} err|manifest 正常加载返回JSON对象，加载错误时返回错误信息对象
 */
internals.getManifest = (args) => {
  let manifest
  const manifestPath = Path.resolve(process.cwd(), args.c)

  try {
    manifest = require(manifestPath)
  } catch (err) {
    console.log('无法加载配置文件: %s (%s)', args.c, err.message)
    return err
  }

  internals.parseEnv(manifest)

  return manifest
}

/**
 * 用于 server.cache 和 register.plugins[]的模块路径
 * @param {Array<>} args 命令行参数
 * @param {Object} 配置参数对象
 * @return {Object}
 */
internals.loadPacks = async function (args, manifest) {
  const options = {}

  options.preRegister = manifest.preRegister

  delete manifest.preRegister

  if (!args.p) {
    return options
  }

  const realPath = Util.promisify(Fs.realpath)
  const path = await realPath(args.p)

  options.relativeTo = path
  return options
}

/**
 * 递归解析配置文件，将将配置文件中带有$env.前缀的解析为相对应的环境变量值
 * @param {Object} 配置JSON对象
 */
internals.parseEnv = (manifest) => {
  if (!manifest || typeof manifest !== 'object') {
    return
  }

  Object.keys(manifest).forEach((key) => {
    const value = manifest[key]
    if (typeof value === 'string' && value.startsWith('$env.')) {
      manifest[key] = process.env[value.slice(5)]
    } else {
      internals.parseEnv(value)
    }
  })
}

/**
 * 加载.env文件
 * @param {Array<>} args 命令行参数
 */
internals.loadDotEnvFile = function (args) {
  if (!args.dotenv) {
    return
  }
  const dotEnvPath = Path.join(
    args.p ? Fs.realpathSync(args.p) : process.cwd(),
    '.env'
  )
  const result = DotEnv.load({ path: dotEnvPath })
  if (result.error) {
    console.error('Failed loading .env configuration file: %s ', result.error.path)
    throw result.error
  }
  return result.parsed
}

/**
 * 主函数
 * @param {Array<>} options 命令行参数
 */
exports.start = async function (options) {
  const args = Bossy.parse(internals.definition, {
    argv: options.args
  })

  if (args instanceof Error) {
    console.error(
      Bossy.usage(
        internals.definition,
        'gz-firestart -c manifest.json [-p node_modules_path -r pre_load_module]'
      )
    )
    return process.exit(1)
  }

  if (args.h) {
    console.log(
      Bossy.usage(
        internals.definition,
        'gz-firestart -c manifest.json [-p node_modules_path -r pre_load_module]'
      )
    )
    return process.exit(1)
  }

  if (internals.loadDotEnvFile(args) instanceof Error) {
    return process.exit(1)
  }

  if (internals.loadExtras(args) instanceof Error) {
    return process.exit(1)
  }

  const manifest = internals.getManifest(args)

  if (manifest instanceof Error) {
    return process.exit(1)
  }

  let server
  process.once('SIGQUIT', async () => {
    await server.stop()
    process.exit(0)
  })

  // Use kill -s SIGUSR2 {pid} to restart the servers
  process.on('SIGUSR2', async () => {
    console.log('Stopping...')
    await server.stop()
    console.log('Starting...')
    exports.start(options)
  })

  try {
    const packOptions = await internals.loadPacks(args, manifest)
    server = await Glue.compose(manifest, packOptions)
    server.events.on('start', () => {
      server.log(
        ['info', 'firestart'],
        `服务启动，访问地址 ${server.info.uri}`
      )
    })
    server.events.on('stop', () => {
      server.log(
        ['info', 'firestarter'],
        '服务停止'
      )
    })
    await server.start()
  } catch (err) {
    console.error(err)
    return process.exit(1)
  }
}