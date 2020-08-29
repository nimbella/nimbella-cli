/*
 * Copyright (c) 2019 - present Nimbella Corp.
 *
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { spawn } from 'child_process'
import { ActionSpec, PackageSpec, WebResource, BuildTable, Flags, ProjectReader, PathKind, Feedback } from './deploy-struct'
import {
  FILES_TO_SKIP, actionFileToParts, filterFiles, mapPackages, mapActions, convertToResources, convertPairsToResources,
  promiseFilesAndFilterFiles
} from './util'
import * as path from 'path'
import * as fs from 'fs'
import ignore from 'ignore'
import * as archiver from 'archiver'
import * as touch from 'touch'
import * as makeDebug from 'debug'
import { isGithubRef } from './github'
import { Writable } from 'stream'
import * as memoryStreams from 'memory-streams'

const debug = makeDebug('nim:deployer:finder-builder')
const zipDebug = makeDebug('nim:deployer:zip')

// Type to use with the ignore package.
interface Ignore {
    filter: (arg: string[]) => string[]
}

const ZIP_TARGET = '__deployer__.zip'

// Determine the build type for an action that is defined as a directory
export function getBuildForAction(filepath: string, reader: ProjectReader): Promise<string> {
  return readDirectory(filepath, reader).then(items => findSpecialFile(items, filepath, true))
}

// Build all the actions in an array of PackageSpecs, returning a new array of PackageSpecs.  We try to return
// undefined for the case where no building occurred at all, since we are obligated to return a full array if
// any building occured, even if most things weren't subject to building.
export function buildAllActions(pkgs: PackageSpec[], buildTable: BuildTable, flags: Flags, reader: ProjectReader,
  feedback: Feedback): Promise<PackageSpec[]> {
  if (!pkgs || pkgs.length === 0) {
    return undefined
  }
  // If there are any packages, we are going to have to search through them but if none of them build anything we can punt
  const pkgMap = mapPackages(pkgs)
  const promises: Promise<PackageSpec>[] = []
  for (const pkg of pkgs) {
    if (pkg.actions && pkg.actions.length > 0) {
      const builtPackage = buildActionsOfPackage(pkg, buildTable, flags, reader, feedback)
      promises.push(builtPackage)
    }
  }
  if (promises.length === 0) {
    return undefined
  }
  return Promise.all(promises).then((newpkgs: PackageSpec[]) => {
    for (const pkg of newpkgs) {
      if (pkg) {
        pkgMap[pkg.name] = pkg
      }
    }
    return Object.values(pkgMap)
  })
}

// Build the actions of a package, returning an updated PackageSpec or undefined if nothing got built
async function buildActionsOfPackage(pkg: PackageSpec, buildTable: BuildTable, flags: Flags, reader: ProjectReader,
  feedback: Feedback): Promise<PackageSpec> {
  const actionMap = mapActions(pkg.actions)
  let nobuilds = true
  for (const action of pkg.actions) {
    if (action.build) {
      nobuilds = false
      const builtAction = await buildAction(action, buildTable, flags, reader, feedback)
      actionMap[action.name] = builtAction
    }
  }
  if (nobuilds) {
    return undefined
  }
  pkg.actions = Object.values(actionMap)
  return pkg
}

// Perform the build defined for an action or just return the action if there is no build step
function buildAction(action: ActionSpec, buildTable: BuildTable, flags: Flags, reader: ProjectReader, feedback: Feedback): Promise<ActionSpec> {
  if (!action.build) {
    return Promise.resolve(action)
  }
  debug('building action %O', action)
  let actionDir
  switch (action.build) {
  case 'build.sh':
    actionDir = makeLocal(reader, action.file)
    return scriptBuilder('./build.sh', actionDir, action.displayFile, flags, feedback).then(() => identifyActionFiles(action,
      flags.incremental, flags.verboseZip, reader, feedback))
  case 'build.cmd':
    actionDir = makeLocal(reader, action.file)
    return scriptBuilder('build.cmd', actionDir, action.displayFile, flags, feedback).then(() => identifyActionFiles(action,
      flags.incremental, flags.verboseZip, reader, feedback))
  case '.build':
    actionDir = makeLocal(reader, action.file)
    return outOfLineBuilder(actionDir, action.displayFile, buildTable, true, flags, reader, feedback).then(() => identifyActionFiles(action,
      flags.incremental, flags.verboseZip, reader, feedback))
  case 'package.json':
    actionDir = makeLocal(reader, action.file)
    return npmBuilder(actionDir, action.displayFile, flags, feedback).then(() => identifyActionFiles(action,
      flags.incremental, flags.verboseZip, reader, feedback))
  case '.include':
  case 'identify':
    return identifyActionFiles(action,
      flags.incremental, flags.verboseZip, reader, feedback)
  default:
    throw new Error('Unknown build type in ActionSpec: ' + action.build)
  }
}

// Process .include file by reading it, recognize any .. or absolute path references, expanding directories, and filtering the result.
// Returns a list of pairs.  In each pair, the first member is the path of a file to be included.  The second member is its name the file
// should assume once included.  For simple cases (files and directories that are inside the directory that contains the .include) these
// will be the same.  For complex cases (absolute paths or .. directives) they will differ.
function processInclude(includesPath: string, dirPath: string, reader: ProjectReader): Promise<string[][]> {
  debug("processing includes from '%s'", includesPath)
  return readFileAsList(includesPath, reader).then(items => processIncludeFileItems(items, dirPath, reader))
}

// Used instead of path.resolve to deal with possible '..' directives.  We don't want absolute path names
// as a result, nor do we want the current directory to be consulted, just path concatenation and normalization.
function joinAndNormalize(...paths: string[]): string {
  return path.normalize(path.join(...paths))
}

// Convert a path that is relative to the project root into a path usable with 'fs'.  This should be done only for things
// that require real building since it will abort the deploy when the project root is a github location.
function makeLocal(reader: ProjectReader, ...paths: string[]): string {
  const project = reader.getFSLocation()
  if (!project) {
    throw new Error('invalid call to makeLocal')
  }
  return path.resolve(project, ...paths)
}

// Subroutine of processInclude to run after items are read
async function processIncludeFileItems(items: string[], dirPath: string, reader: ProjectReader): Promise<string[][]> {
  const complex: Promise<string[][]>[] = []
  const simple: string[][] = []
  for (const item of items) {
    if (!item || item.length === 0) {
      continue
    }
    debug('processing include item %s', item)
    let oldPath = path.isAbsolute(item) ? item : joinAndNormalize(dirPath, item)
    if (oldPath.endsWith('/') || oldPath.endsWith('\\')) {
      oldPath = oldPath.slice(0, -1)
    }
    // TODO note that if the path actually is absolute it won't work when deploying from github
    // The little hack here keeps it working for the local case.
    debug("Calculated oldPath '%s'", oldPath)
    const lstat: PathKind = await reader.getPathKind(oldPath)
    if (!lstat) {
      return Promise.reject(new Error(`${oldPath} is included for '${dirPath}' but does not exist`))
    }
    let newPath: string
    const mightBeOutside = item.includes('..') || path.isAbsolute(item)
    if (mightBeOutside) {
      newPath = path.basename(item)
    } else {
      newPath = item
    }
    const toElide = oldPath.length - newPath.length
    debug("Calculated newPath '%s' with elision %d", newPath, toElide)
    if (lstat.isFile) {
      simple.push([oldPath, newPath])
    } else if (lstat.isDirectory) {
      const expanded = promiseFilesAndFilterFiles(oldPath, reader).then(items => items.map(item => [item, item.slice(toElide)]))
      debug("Expanded directory '%s'", oldPath)
      complex.push(expanded)
    } else {
      return Promise.reject(new Error(`'${item}' is neither a file nor a directory`))
    }
  }
  return Promise.all(complex.concat(Promise.resolve(simple))).then(arrays => arrays.reduce((prev, curr) => prev.concat(curr), []))
}

// Identify the files that make up an action directory, based on the files in the directory and .include. .source, or .ignore if present.
// If there is more than one file, perform autozipping.
async function identifyActionFiles(action: ActionSpec, incremental: boolean, verboseZip: boolean, reader: ProjectReader,
  feedback: Feedback): Promise<ActionSpec> {
  let includesPath = path.join(action.file, '.include')
  if (!await reader.isExistingFile(includesPath)) {
    // Backward compatibility: try .source also
    includesPath = path.join(action.file, '.source')
  }
  if (await reader.isExistingFile(includesPath)) {
    // If there is .include or .source, it is canonical and all else is ignored
    return processInclude(includesPath, action.file, reader).then(pairs => {
      if (pairs.length === 0) {
        return Promise.reject(new Error(includesPath + ' is empty'))
      } else if (pairs.length > 1) {
        return autozipBuilder(pairs, action, incremental, verboseZip, reader, feedback)
      } else {
        return singleFileBuilder(action, pairs[0][0])
      }
    })
  }
  return getIgnores(action.file, reader).then(ignore => {
    return promiseFilesAndFilterFiles(action.file, reader).then((items: string[]) => {
      items = applyIgnores(action.file, items, ignore)
      if (items.length === 0) {
        return Promise.reject(new Error(`Action '${action.name}' has no included files`))
      } else if (items.length === 1) {
        return singleFileBuilder(action, items[0])
      } else {
        const pairs = items.map(item => {
          const shortName = item.substring(action.file.length + 1)
          return [item, shortName]
        })
        return autozipBuilder(pairs, action, incremental, verboseZip, reader, feedback)
      }
    })
  })
}

// Utility for applying the ignore filter.  Sensitive to the limitations of the 'ignore' npm package.
function applyIgnores(basePath: string, items: string[], ignore: Ignore) {
  // If the basepath is already absolute, relativize in hopes that that all paths will be internal.
  // TODO this is not a panacea: we need to pin down our assumptions about how ignore is supposed to work.
  const absolute = path.isAbsolute(basePath)
  if (absolute) {
    items = items.map(item => path.relative(basePath, item))
  }
  // Do the filtering
  items = ignore.filter(items)
  // Restore absolute paths
  if (absolute) {
    items = items.map(item => path.join(basePath, item))
  }
  return items
}

// Utility for reading .include, .source, or .build
function readFileAsList(file: string, reader: ProjectReader): Promise<string[]> {
  return reader.readFileContents(file).then(data =>
    (String(data).split('\n').filter(line => line && line.trim().length > 0).map(line => line.trim()))
  )
}

// Perform a build using either a script or a directory pointed to by a .build directive
// The .build directive is known to exist but has not been read yet.
function outOfLineBuilder(filepath: string, displayPath: string, sharedBuilds: BuildTable,
  isAction: boolean, flags: Flags, reader: ProjectReader, feedback: Feedback): Promise<any> {
  const buildPath = path.join(filepath, '.build')
  return readFileAsList(buildPath, reader).then(async contents => {
    if (contents.length === 0 || contents.length > 1) {
      return Promise.reject(new Error(buildPath + ' contains too many or too few lines'))
    }
    const redirected = joinAndNormalize(filepath, contents[0])
    const stat: PathKind = await reader.getPathKind(redirected)
    if (stat.isFile) {
      // Simply run linked-to script in the current directory
      return scriptBuilder(redirected, filepath, displayPath, flags, feedback)
    } else if (stat.isDirectory) {
      // Look in the directory to find build to run
      return readDirectory(redirected, reader).then(items => {
        const special = findSpecialFile(items, filepath, isAction)
        let build: () => Promise<any>
        const cwd = makeLocal(reader, redirected)
        switch (special) {
        case 'build.sh':
        case 'build.cmd': {
          const script = makeLocal(reader, redirected, special)
          // Like the direct link case, just a different way of doing it
          build = () => scriptBuilder(script, cwd, displayPath, flags, feedback)
          break
        }
        case 'package.json':
          build = () => npmBuilder(cwd, displayPath, flags, feedback)
          break
        default:
          return Promise.reject(new Error(redirected + ' is a directory but contains no build information'))
        }
        // Before running the selected build, check for shared build
        if (isSharedBuild(items)) {
          // The build is shared so we only run it once
          const buildKey = makeLocal(reader, redirected)
          let buildStatus = sharedBuilds[buildKey]
          if (buildStatus) {
            // It's already been claimed and is either complete or in progress
            feedback.progress(`Skipping shared build for '${filepath}' ... already run in this deployment`)
            debug('buildStatus is %O', buildStatus)
            if (buildStatus.built) {
              debug('Found completed build')
              return Promise.resolve(true)
            } else if (buildStatus.error) {
              debug('Found error in build')
              return Promise.reject(buildStatus.error)
            } else {
              // Make a promise that will stay pending until later
              debug('Found shared build still running')
              return new Promise(function(resolve, reject) {
                buildStatus.pending.push(function(err) {
                  if (err) {
                    reject(err)
                  } else {
                    resolve(true)
                  }
                })
              })
            }
          } else {
            // It has not been run, so we take responsibility for running it
            feedback.progress(`Running shared build for '${filepath}', results may be reused`)
            buildStatus = { pending: [], built: false, error: undefined }
            sharedBuilds[buildKey] = buildStatus
            return build().then(resultPromise => {
              debug('shared build completed successfully with resultPromise %O', resultPromise)
              buildStatus.built = true
              const toResolve = buildStatus.pending
              buildStatus.pending = []
              toResolve.forEach(fcn => fcn(undefined))
              return true
            }).catch(err => {
              debug('shared build completed with error')
              buildStatus.error = err
              const toResolve = buildStatus.pending
              toResolve.forEach(fcn => fcn(err))
              throw err
            })
          }
        } else {
          // Not shared, so we run it and return the promise of its completion
          feedback.progress('Build is not shared')
          return build()
        }
      })
    }
  })
}

// Determine if a build directory reached via .build is shared by looking for a file called .shared
function isSharedBuild(items: PathKind[]): boolean {
  let shared = false
  items.forEach(item => {
    if (!item.isDirectory && item.name === '.shared') {
      shared = true
    }
  })
  return shared
}

// Determine the build step for the web directory or return undefined if there isn't one
export function getBuildForWeb(filepath: string, reader: ProjectReader): Promise<string> {
  if (!filepath) {
    return Promise.resolve(undefined)
  }
  return readDirectory(filepath, reader).then(items => findSpecialFile(items, filepath, false))
}

// Build the web directory
export function buildWeb(build: string, sharedBuilds: BuildTable, filepath: string, displayPath: string,
  flags: Flags, reader: ProjectReader, feedback: Feedback): Promise<WebResource[]> {
  debug('Performing Web build')
  let scriptPath
  switch (build) {
  case 'build.sh':
    scriptPath = makeLocal(reader, filepath)
    return scriptBuilder('./build.sh', scriptPath, displayPath, flags, feedback).then(() => identifyWebFiles(filepath, reader))
  case 'build.cmd':
    debug('cwd for windows build is %s', filepath)
    scriptPath = makeLocal(reader, filepath)
    return scriptBuilder('build.cmd', scriptPath, displayPath, flags, feedback).then(() => identifyWebFiles(filepath, reader))
  case '.build':
    // Does its own localizing
    return outOfLineBuilder(filepath, displayPath, sharedBuilds, false, flags, reader, feedback).then(() => identifyWebFiles(filepath, reader))
  case 'package.json':
    scriptPath = makeLocal(reader, filepath)
    return npmBuilder(scriptPath, displayPath, flags, feedback).then(() => identifyWebFiles(filepath, reader))
  case '.include':
  case 'identify':
    return identifyWebFiles(filepath, reader)
  default:
    throw new Error('Unknown build type for web directory: ' + build)
  }
}

// Identify the files constituting web content.  Similar to its action counterpart but not identical (e.g. there is no zipping)
// For web content, we also fail the deployment if there are node_modules inclusions but no .include directive.  That
// is usually an error.  In case it is not, the user can indicate it's ok by adding an .include that lists node_modules explicitly.
async function identifyWebFiles(filepath: string, reader: ProjectReader): Promise<WebResource[]> {
  debug('Identifying web files')
  const includesPath = path.join(filepath, '.include')
  if (await reader.isExistingFile(includesPath)) {
    // If there is .include, it defines what to include and we need not look elsewhere
    debug('processing .include')
    return processInclude(includesPath, filepath, reader).then(pairs => convertPairsToResources(pairs))
  }
  debug('Processing web files using .ignore')
  // Otherwise, we take the contents modulo the ignores
  return getIgnores(filepath, reader).then(ignore => {
    debug('processing .ignore and/or ignore rules')
    return promiseFilesAndFilterFiles(filepath, reader).then((items: string[]) => {
      items = applyIgnores(filepath, items, ignore)
      checkForNodeModules(items)
      debug(`Converting ${items.length} items to resources`)
      return convertToResources(items, filepath.length + 1)
    })
  })
}

// Fail the deployment if there are node_modules items about to be deployed to the web.  This
// is called only when there is no `.include` directive.
function checkForNodeModules(items: string[]) {
  items.forEach(item => {
    if (item.includes('node_modules')) {
      throw new Error('Deploying \'node_modules\' to the web, which is probably an error.  Use \'.include\' or \'.ignore\' to avoid this problem.')
    }
  })
}

// Read a directory and filter the result
function readDirectory(filepath: string, reader: ProjectReader): Promise<PathKind[]> {
  return reader.readdir(filepath).then(filterFiles)
}

// Check whether a list of names that are candidates for zipping can agree on a runtime.  This is called only when the
// config doesn't already provide a runtime.
function agreeOnRuntime(items: string[]): string {
  let agreedRuntime: string
  items.forEach(item => {
    const { runtime } = actionFileToParts(item)
    if (runtime) {
      if (agreedRuntime && runtime !== agreedRuntime) {
        return undefined
      }
      agreedRuntime = runtime
    }
  })
  return agreedRuntime
}

// Find the "dominant" special file in a collection of files within an action or web directory, while checking for some errors
// The dominance order is build.[sh|cmd] > .build > package.json > .include > none-of-these (returns 'identify' since 'building' will
//   then start by identifying files)
// Errors detected are:
//    .build when there is also build.sh or build.cmd
//    build.sh but no build.cmd on a windows system
//    build.cmd but no build.sh on a macos or linux system
//    .ignore when there is also .include
//    no files in directory (or only an .ignore file); actions only (web directory is permitted to be empty)
function findSpecialFile(items: PathKind[], filepath: string, isAction: boolean): string {
  const files = items.filter(item => !item.isDirectory)
  let buildDotSh = false; let buildDotCmd = false; let npm = false; let include = false; let dotBuild = false; let ignore = false
  for (const file of files) {
    if (file.name === 'build.sh') {
      buildDotSh = true
    } else if (file.name === 'build.cmd') {
      buildDotCmd = true
    } else if (file.name === 'package.json') {
      npm = true
    } else if (file.name === '.include' || file.name === '.source') {
      include = true
    } else if (file.name === '.ignore') {
      ignore = true
    } else if (file.name === '.build') {
      dotBuild = true
    }
  }
  // Error checks
  if (dotBuild && (buildDotSh || buildDotCmd)) {
    throw new Error(`In ${filepath}: '.build' should not be present alongside 'build.sh' or 'build.cmd'`)
  } else if (include && ignore) {
    throw new Error(`In ${filepath}: '.include' (or '.source') and '.ignore' may not both be present`)
  } else if (isAction && (files.length === 0 || (ignore && files.length === 1))) {
    throw new Error(`Action directory ${filepath} has no files`)
  }
  if (process.platform === 'win32') {
    if (buildDotSh && !buildDotCmd) {
      throw new Error(`In ${filepath}: 'build.sh' won't run on this platform and no 'build.cmd' is provided`)
    }
    if (buildDotCmd) {
      return 'build.cmd'
    }
  } else { // mac or linux
    if (!buildDotSh && buildDotCmd) {
      throw new Error(`In ${filepath}: 'build.cmd' won't run on this platform and no 'build.sh' is provided`)
    }
    if (buildDotSh) {
      return 'build.sh'
    }
  }
  return dotBuild ? '.build' : npm ? 'package.json' : include ? '.include' : 'identify'
}

// The 'builder' for use when the action is a single file after all other processing
function singleFileBuilder(action: ActionSpec, file: string): Promise<ActionSpec> {
  debug("singleFileBuilder deploying '%s'", file)
  const newMeta = actionFileToParts(file) as ActionSpec
  delete newMeta.name
  newMeta.web = true
  // After a build, only the file, zipped, and binary flags take precedence over what's in the action already.
  // Metadata calcuated from the file name is filled in, as is the default for web, but these apply only if not
  // already specified in the action (except for binary and zipped, which always change to match the build result).
  const { binary, zipped } = newMeta
  const newAction = Object.assign(newMeta, action, { file, binary, zipped })
  return Promise.resolve(newAction)
}

// The 'builder' for when multiple files (and/or directories) have been identified as constituting the action.
// 1.  If there is an existing ZIP_TARGET
//    a.  If incremental is specified, see whether the autozip can be skipped
//    b.  Otherwise, remove the old zip.
// 2.  If there is a runtime provided in the ActionSpec we leave it there.  Otherwise, we scan the files to see if we
//     can decide on an unambiguous runtime value.  If we can't, it's an error.
// 3.  Use archiver to zip the items individually, according to the rules that
//     - an item is renamed to the basename of the item if it contains .. or is an absolute path
//     - an item is zipped as is otherwise
//     - directories are zipped recursively
// 4.  Return an ActionSpec promise describing the result.
async function autozipBuilder(pairs: string[][], action: ActionSpec, incremental: boolean, verboseZip: boolean, reader: ProjectReader,
  feedback: Feedback): Promise<ActionSpec> {
  if (verboseZip) { feedback.progress('Zipping action contents in', action.file) } else { debug('Zipping action contents in %s', action.file) }
  if (!action.runtime) {
    action.runtime = agreeOnRuntime(pairs.map(pair => pair[0]))
  }
  // If there's real file system, observe and store the zip results there for incremental support
  const targetZip = path.join(action.file, ZIP_TARGET)
  const inMemory = reader.getFSLocation() === null
  let output: Writable
  if (!inMemory) {
    zipDebug('zipping to %s for action %s', targetZip, action.name)
    const localTargetZip = makeLocal(reader, targetZip)
    pairs = pairs.map(pair => [makeLocal(reader, pair[0]), pair[1]])
    if (fs.existsSync(localTargetZip)) {
      zipDebug('the file exists and will be either reused or deleted')
      if (incremental) {
        const metaFiles: string[] = [makeLocal(reader, action.file, '.include'), makeLocal(reader, action.file, '.ignore')].filter(fs.existsSync)
        debug('checking whether to build a new zip for %s with metaFiles %o', action.name, metaFiles)
        if (zipFileAppearsCurrent(localTargetZip, pairs.map(pair => pair[0]).concat(metaFiles))) {
          return singleFileBuilder(action, targetZip)
        }
      }
      zipDebug('deleting old target zip')
      fs.unlinkSync(localTargetZip)
    }
    output = fs.createWriteStream(localTargetZip)
  } else {
    zipDebug('zipping to memory buffer for action %s', action.name)
    output = new memoryStreams.WritableStream()
  }
  const zip = archiver('zip')
  const outputPromise = new Promise(function(resolve, reject) {
    zip.on('error', err => {
      zipDebug('zip error occurred: %O', err)
      reject(err)
    })
    output.on('close', () => {
      zipDebug('zipfile successfully closed')
      resolve(undefined)
    })
    output.on('finish', () => {
      zipDebug('zipfile successfully finished')
      resolve(undefined)
    })
    output.on('end', () => {
      zipDebug('zipfile data has been drained')
    })
    zip.on('warning', err => {
      zipDebug('warning issued from archiver %O', err)
      if (err.code !== 'ENOENT') {
        reject(err)
      }
    })
  })
  zip.pipe(output)
  zipDebug('zipping %d files', pairs.length)
  for (const pair of pairs) {
    const [oldPath, newPath] = pair
    const mode = (await reader.getPathKind(oldPath)).mode
    const data = await reader.readFileContents(oldPath)
    zipDebug("Zipping file with old path '%s', buffer length '%d', new path '%s', and mode %d", oldPath, data.length, newPath, mode)
    zip.append(data, { name: newPath, mode: mode })
    zipDebug("Zipped '%s' for action '%s', emitted %d", newPath, action.name, zip.pointer())
  }
  zipDebug('finalizing zip for action %s', action.name)
  zip.finalize()
  zipDebug('zip finalized for action %s', action.name)
  return outputPromise.then(() => {
    if (verboseZip) { feedback.progress('Zipping complete in', action.file) } else { debug('zipping complete for %s', action.name) }
    if (inMemory) {
      const code = (output as memoryStreams.WritableStream).toBuffer().toString('base64')
      if (!code) {
        return Promise.reject(new Error('An error occurred in in-memory zipping'))
      }
      zipDebug('in memory zipping complete with code of length %d', code.length)
      action.code = code as string
      return singleFileBuilder(action, action.file)
    } else {
      return singleFileBuilder(action, targetZip)
    }
  })
}

// Subroutine for performing a "real" build requiring a spawn.
function build(cmd: string, args: string[], realPath: string, displayPath: string, infoMsg: string,
  errorTag: string, verbose: boolean, feedback: Feedback): Promise<any> {
  debug('building with realPath=%s and displayPath=%s', realPath, displayPath)
  let result = ''
  const time = Date.now()
  function statusUpdate(data: { toString: () => string }) {
    result += data.toString()
    const newTime = Date.now()
    if ((newTime - time) > 5000) {
      feedback.progress('Still running', infoMsg, 'in', displayPath)
    }
  }
  return new Promise(function(resolve, reject) {
    feedback.progress('Started running', infoMsg, 'in', displayPath)
    const shell = process.platform === 'win32' ? true : process.env.shell || '/bin/bash'
    const child = spawn(cmd, args, { cwd: realPath, shell })
    if (verbose) {
      child.stdout.on('data', (data) => feedback.progress(String(data)))
      child.stderr.on('data', (data) => feedback.warn(String(data)))
    } else {
      child.stdout.on('data', statusUpdate)
      child.stderr.on('data', statusUpdate)
    }
    child.on('close', (code) => {
      if (code !== 0) {
        if (!verbose) {
          feedback.warn('Output of failed build in %s', realPath)
          if (isGithubRef(displayPath)) {
            feedback.warn('%s is a cache location for %s', realPath, displayPath)
          }
          feedback.warn(result)
        }
        reject(new Error(`'${errorTag}' exited with code ${code}`))
      } else {
        feedback.progress('Finished running', infoMsg, 'in', displayPath)
        resolve(undefined)
      }
    })
    child.on('error', (err) => {
      reject(err)
    })
  })
}

// The builder for a shell script
function scriptBuilder(script: string, realPath: string, displayPath: string, flags: Flags, feedback: Feedback): Promise<any> {
  if (flags.incremental && scriptAppearsBuilt(realPath)) {
    if (flags.verboseBuild) {
      feedback.progress(`Skipping build in ${displayPath} because the action was previously built`)
    }
    return Promise.resolve(true)
  }
  return build(script, [], realPath, displayPath, script, script, flags.verboseBuild, feedback)
}

// Determine if a shell-script style build appears to have been run.  For this we just check for the presence of a `.built` file since
// we don't have any dependency information.  If the author of the build wants to do better, he should do dependency checking _in_ the build
// and never write a `.built` marker; in that case, the build will always run but will usually do very little.
function scriptAppearsBuilt(filepath: string): boolean {
  const toTest = path.join(filepath, '.built')
  return fs.existsSync(toTest)
}

// Determine if a new zip should be generated.  The existing zip is considered current if it is newer than its dependencies.
// This won't happen when zipping is in memory because that only happens in the 'from github' case which does not support incremental.
function zipFileAppearsCurrent(zipfile: string, dependencies: string[]): boolean {
  const ziptime = fs.statSync(zipfile).mtimeMs
  for (const dep of dependencies) {
    if (fs.existsSync(dep)) {
      if (fs.statSync(dep).mtimeMs > ziptime) {
        debug('%s not considered current because %s is newer', zipfile, dep)
        return false
      }
    } else {
      debug("dependency %s doesn't exist", dep)
      return false // play it safe
    }
  }
  debug('%s seems up to date so no re-zip', zipfile)
  return true
}

// Determine if an npm|yarn style build appears to have been run "recently enough".  This is heuristic and does not do a full dependency check.
// It returns true iff both `node_modules` and either of `package-lock.json` or `yarn.lock` are present and newer than `package.json`.
function npmPackageAppearsBuilt(filepath: string): boolean {
  const packageJson = path.join(filepath, 'package.json')
  const packageLockJson = path.join(filepath, 'package-lock.json')
  const yarnLock = path.join(filepath, 'yarn.lock')
  const nodeModules = path.join(filepath, 'node_modules')
  const packageJsonTime = fs.statSync(packageJson).mtimeMs
  const packageLockJsonTime = fs.existsSync(packageLockJson) ? fs.statSync(packageLockJson).mtimeMs : 0
  const nodeModulesTime = fs.existsSync(nodeModules) ? fs.statSync(nodeModules).mtimeMs : 0
  const yarnLockTime = fs.existsSync(yarnLock) ? fs.statSync(yarnLock).mtimeMs : 0
  const lockTime = yarnLockTime > packageLockJsonTime ? yarnLockTime : packageLockJsonTime
  return lockTime >= packageJsonTime && nodeModulesTime >= packageJsonTime
}

// To avoid getting 'stuck' when package.json changes in a way that does not cause an update to the lock file or node_modules,
// we touch these resources after every npm build
function makeNpmPackageAppearBuilt(filepath: string) {
  const packageLockJson = path.join(filepath, 'package-lock.json')
  if (fs.existsSync(packageLockJson)) touch(packageLockJson)
  const yarnLock = path.join(filepath, 'yarn.lock')
  if (fs.existsSync(yarnLock)) touch(yarnLock)
  const nodeModules = path.join(filepath, 'node_modules')
  if (fs.existsSync(nodeModules)) touch(nodeModules)
}

// The builder for npm|yarn install --production or npm|yarn install && npm|yarn run build
// A package.json must be present since this builder wouldn't have been invoked otherwise.
// This doesn't mean that npm|yarn install will succeed, just that, if it fails it is for some other reason
function npmBuilder(filepath: string, displayPath: string, flags: Flags, feedback: Feedback): Promise<any> {
  debug('Performing npm build for %s', filepath)
  const cmd = flags.yarn ? 'yarn' : 'npm'
  const npmRunBuild = buildScriptExists(filepath)
  const args = npmRunBuild ? ['install', '&&', cmd, 'run', 'build'] : ['install', '--production']
  const infoMsg = [cmd, ...args].join(' ')
  if (flags.incremental) {
    debug('Detected incremental build')
    const pkgBuilt = npmPackageAppearsBuilt(filepath)
    const scriptBuilt = scriptAppearsBuilt(filepath)
    const shouldSkip = npmRunBuild ? pkgBuilt && scriptBuilt : pkgBuilt
    debug(`npmRunBuild=${!!npmRunBuild}, npmPackageAppearsBuilt=${pkgBuilt}, scriptAppearsBuilt=${scriptBuilt}, shouldSkip=${shouldSkip}`)
    if (shouldSkip) {
      if (flags.verboseBuild) {
        feedback.progress(`Skipping '${infoMsg}' in ${filepath} because the previous build is still valid`)
      }
      return Promise.resolve(true)
    }
  } else {
    debug('Build was not incremental')
  }
  return build(cmd, args, filepath, displayPath, infoMsg, `${cmd} install`, flags.verboseBuild, feedback).then(
    () => makeNpmPackageAppearBuilt(filepath))
}

// Test whether the `package.json` of a filepath (known to exist) contains a 'build' script.
// We can assume that the local file system is usable.
function buildScriptExists(filepath: string): boolean {
  const contents = fs.readFileSync(path.join(filepath, 'package.json'))
  const pj = JSON.parse(String(contents))
  return pj.scripts && pj.scripts.build
}

// Get the Ignore object for screening files.  This always has the fixed entries for .ignore itself, .build, build.sh, and .build.cmd
// but adds anything found in an .ignore file.  Note that package.json is not ignored, even though it is a build trigger.  We
// also don't add an entry for .include (or .source) since that case is driven by a fixed set of files and not by scanning a directory.
function getIgnores(dir: string, reader: ProjectReader): Promise<Ignore> {
  const filePath = path.join(dir, '.ignore')
  const fixedItems = ['.ignore', '.build', 'build.sh', 'build.cmd', ZIP_TARGET, ...FILES_TO_SKIP]
  return readFileAsList(filePath, reader).then(items => {
    return ignore().add(items.concat(fixedItems))
  }).catch(() => {
    return ignore().add(fixedItems)
  })
}
