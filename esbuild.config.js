const esbuild = require('esbuild')
const globby = require('globby')
const rimraf = require('rimraf')

// Automatically exclude all node_modules from the bundled version
const { nodeExternalsPlugin } = require('esbuild-node-externals')

const exit = (err) => {
  console.error(err)
  process.exit(1)
}

const removeExistingBuildOutput = async () => {
  return new Promise((resolve, reject) => {
    rimraf('./lib', (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

const findSourceFiles = async () => globby('./src/**/*.ts')

const build = async files => {
  console.log(`starting esbuild with ${files.length} source files.`)
  console.time('build finished in')
  return esbuild.build({
    entryPoints: files,
    format: 'cjs',
    outdir: 'lib',
    // bundle & minify output file
    bundle: false,
    minify: true,
    platform: 'node',
    sourcemap: true,
    target: 'node14',
    plugins: [nodeExternalsPlugin()]
  })
}

removeExistingBuildOutput()
  .then(findSourceFiles)
  .then(build)
  .then(() => console.timeEnd('build finished in'))
  .catch(err => exit(err))
