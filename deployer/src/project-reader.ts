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

import * as path from 'path'
import * as fs from 'fs'
import { getUserAgent } from './api'
import { DeployStructure, PackageSpec, ActionSpec, WebResource, Includer, ProjectReader, PathKind, Feedback } from './deploy-struct'
import { emptyStructure, actionFileToParts, filterFiles, convertToResources, promiseFilesAndFilterFiles, loadProjectConfig, errorStructure, getDeployerAnnotation, getBestProjectName } from './util'
import { getBuildForAction, getBuildForWeb } from './finder-builder'
import { isGithubRef, parseGithubRef, fetchProject } from './github'
import * as makeDebug from 'debug'
import { makeFileReader } from './file-reader'
import { makeGithubReader } from './github-reader'
import { fetchSlice } from './slice-reader'
const debug = makeDebug('nim:deployer:project-reader')

const CONFIG_FILE = 'project.yml'
const LEGACY_CONFIG_FILE = 'projectConfig.yml'
const ENV_FILE = '.env'

// Read the top level files and dirs of the project.  Only one file and two dirs are legal at this level; everything else is a 'stray'
interface TopLevel {
    web: string
    packages: string
    config?: string
    env?: string
    strays: string[]
    filePath: string
    githubPath: string
    includer: Includer
    reader: ProjectReader
    feedback: Feedback
}
export async function readTopLevel(filePath: string, env: string, includer: Includer, mustBeLocal: boolean, feedback: Feedback): Promise<TopLevel> {
  // The mustBeLocal arg is only important if the filePath denotes a github location.  In that case, a true value for
  // mustBeLocal causes the github contents to be fetched to a local cache and a FileReader is used.  A false value
  // causes a GithubReader to be used.
  debug("readTopLevel with filePath:'%s' and mustBeLocal:'%s'", filePath, String(mustBeLocal))
  debug('feedback is %O', feedback)
  // Before doing the more expensive operations, check existence of env, which is cheap.  If does not exist we will fail later anyway.
  if (env && !fs.existsSync(env)) {
    throw new Error(`The specified environment file '${env}' does not exist`)
  }
  let githubPath: string
  let reader: ProjectReader
  if (isGithubRef(filePath)) {
    const github = parseGithubRef(filePath)
    if (!github.auth) {
      feedback.warn('Warning: access to GitHub will be un-authenticated; rate will be severely limited')
    }
    githubPath = filePath
    if (mustBeLocal) {
      debug('github path which must be local, making file reader')
      filePath = await fetchProject(github, getUserAgent())
      reader = makeFileReader(filePath)
    } else {
      debug('Github path which is permitted to be remote, making Github reader')
      reader = makeGithubReader(github, getUserAgent())
    }
  } else {
    debug('not a github path, making file reader')
    if (filePath.startsWith('slice:')) {
      debug('fetching slice')
      filePath = await fetchSlice(filePath.replace('slice:', ''))
      if (!filePath) {
        throw new Error('Could not fetch slice')
      }
    }
    reader = makeFileReader(filePath)
  }
  const webDir = 'web'; const pkgDir = 'packages'
  return reader.readdir('').then(items => {
    items = filterFiles(items)
    let web: string
    let config: string
    let notconfig: string
    let legacyConfig: string
    let packages: string
    const strays: string[] = []
    for (const item of items) {
      if (item.isDirectory) {
        switch (item.name) {
        case webDir:
          if (includer.isWebIncluded) { web = webDir }
          break
        case pkgDir:
          packages = pkgDir
          break
        case '.nimbella':
          break
        default:
          strays.push(item.name)
        }
      } else if (!item.isDirectory && item.name === CONFIG_FILE) {
        config = item.name
      } else if (!item.isDirectory && item.name === LEGACY_CONFIG_FILE) {
        legacyConfig = item.name
      } else if (!item.isDirectory && (item.name.endsWith('.yml') || item.name.endsWith('.yaml'))) {
        notconfig = item.name
      } else if (!env && !item.isDirectory && item.name === ENV_FILE) {
        // Env file reading will not go through the reader so use a path that includes a path to the project
        env = path.join(filePath, item.name)
      } else {
        strays.push(item.name)
      }
    }
    if (legacyConfig && !config) {
      config = legacyConfig
      feedback.warn(`Warning: the name '${LEGACY_CONFIG_FILE}' is deprecated; please rename to '${CONFIG_FILE}' soon`)
    }
    if (notconfig && !config) {
      feedback.warn('Warning: found %s but no %s', notconfig, CONFIG_FILE)
    }
    if (githubPath) {
      debug('github path was %s', githubPath)
      debug('filePath is %s', filePath)
    }
    const ans = { web, packages, config, strays, filePath, env, githubPath, includer, reader, feedback }
    debug('readTopLevel returning %O', ans)
    return ans
  })
}

// Probe the top level structure to obtain the major parts of the final config.  Spawn builders for those parts and
// assemble a "Promise.all" for the combined work
export async function buildStructureParts(topLevel: TopLevel): Promise<DeployStructure[]> {
  const { web, packages, config, strays, filePath, env, githubPath, includer, reader, feedback } = topLevel
  let configPart = await readConfig(config, env, filePath, includer, reader, feedback)
  const deployerAnnotation = configPart.deployerAnnotation || await getDeployerAnnotation(filePath, githubPath)
  configPart = Object.assign(configPart, { strays, filePath, githubPath, includer, reader, feedback, deployerAnnotation })
  const displayName = getBestProjectName(configPart)
  debug('display path for actions is %O', displayName)
  const webPart = await getBuildForWeb(web, reader).then(build => buildWebPart(web, build, reader))
  const actionsPart = await buildActionsPart(packages, displayName, includer, reader)
  return [webPart, actionsPart, configPart]
}

// Assemble a complete initial structure containing all file system information and config.  May be deployed as is or adjusted
// before deployment.  Input is the resolved output of buildStructureParts.  At this point, the web part may have names that
// are only suitable for bucket deploy so we check for that problem here.
export function assembleInitialStructure(parts: DeployStructure[]): DeployStructure {
  debug('Assembling structure from parts')
  const [webPart, actionsPart, configPart] = parts
  const errPart = parts.find(part => part.error)
  if (errPart) {
    return errPart
  }
  const strays = (actionsPart.strays || []).concat(configPart.strays || [])
  configPart.strays = strays
  configPart.web = (webPart.web && configPart.web) ? mergeWeb(webPart.web, configPart.web)
    : webPart.web ? webPart.web : configPart.web ? configPart.web : []
  configPart.packages = (actionsPart.packages && configPart.packages) ? mergePackages(actionsPart.packages, configPart.packages)
    : actionsPart.packages ? actionsPart.packages : configPart.packages ? configPart.packages : []
  adjustWebExportFlags(configPart.packages)
  configPart.webBuild = webPart.webBuild
  if (configPart.actionWrapPackage) {
    configPart.web.forEach(res => {
      if (res.simpleName.includes('/')) {
        throw new Error(`Web resource ${res.simpleName} cannot be deployed with action-wrapping (has nested structure)`)
      }
    })
  }
  return configPart
}

// Merge 'web' portion of config, if any, into the 'web' array read from the file system.  The merge key is the
// simple name.
function mergeWeb(fs: WebResource[], config: WebResource[]): WebResource[] {
  const merge = {}
  fs.forEach(resource => {
    merge[resource.simpleName] = resource
  })
  config.forEach(resource => {
    const already = merge[resource.simpleName]
    merge[resource.simpleName] = already ? mergeWebResource(already, resource) : resource
  })
  const ans: WebResource[] = []
  for (const name in merge) {
    ans.push(merge[name])
  }
  return ans
}

// Merge a single WebResource: the file system and config contributions have the same simpleName.  Exactly one must specify
// the filePath or an error is indicated.  For other properties, information in the config takes precedence.
function mergeWebResource(fs: WebResource, config: WebResource): WebResource {
  if (fs.filePath && config.filePath) {
    throw new Error('Config may not specify filePath for WebResource that already has a filePath')
  }
  const ans = Object.assign({}, fs, config)
  if (!ans.filePath) {
    throw new Error(`WebResource ${fs.simpleName} has no filePath`)
  }
  return ans
}

// Merge 'packages' portion of config, if any, into the 'packages' array read from the file system.
// The merge key is the package name.
function mergePackages(fs: PackageSpec[], config: PackageSpec[]): PackageSpec[] {
  const merge = {}
  fs.forEach(pkg => {
    merge[pkg.name] = pkg
  })
  config.forEach(pkg => {
    const already = merge[pkg.name]
    if (already) {
      merge[pkg.name] = mergePackage(already, pkg)
    } else {
      (pkg.actions || []).forEach(action => {
        action.package = pkg.name
      })
      merge[pkg.name] = pkg
    }
  })
  const ans: PackageSpec[] = []
  for (const name in merge) {
    ans.push(merge[name])
  }
  return ans
}

// Merge a single PackageSpec: the file system and config contributions have the same name.  The actions are merged.
// Other attributes are preferentially taken from the config.
function mergePackage(fs: PackageSpec, config: PackageSpec): PackageSpec {
  const fsActions = fs.actions
  const cfgActions = config.actions
  const ans = Object.assign({}, fs, config)
  if (fsActions && fsActions.length > 0) {
    if (cfgActions && cfgActions.length > 0) {
      ans.actions = mergeActions(fsActions, cfgActions, config.name)
    } else {
      ans.actions = fsActions
    }
  } else {
    ans.actions = cfgActions
  }
  return ans
}

// Adjust the web export value for the actions of the project.  For each action that already has this property set, leave it alone.
// Otherwise, if its package specifies a web export value use it.   Otherwise, apply the default of 'true'.   Must test explicitly
// for 'undefined' type since false is a real value but is falsey.
function adjustWebExportFlags(pkgs: PackageSpec[]) {
  pkgs.forEach(pkg => {
    if (pkg.actions) {
      pkg.actions.forEach(action => {
        if (typeof action.web === 'undefined') {
          action.web = (typeof pkg.web === 'undefined') ? true : pkg.web
        }
      })
    }
  })
}

// Merge the actions portion of a PackageSpec in config, if any, into the corresponding PackageSpec actions read from the file system.
// The merge key is the action name.
function mergeActions(fs: ActionSpec[], config: ActionSpec[], pkgName: string): ActionSpec[] {
  const merge = {}
  fs.forEach(action => {
    merge[action.name] = action
  })
  config.forEach(action => {
    const already = merge[action.name]
    if (already) {
      merge[action.name] = mergeAction(already, action)
    } else {
      action.package = pkgName
      merge[action.name] = action
    }
  })
  const ans: ActionSpec[] = []
  for (const name in merge) {
    ans.push(merge[name])
  }
  return ans
}

// Merge a single ActionSpec: the file system and config contributions have the same name.  The config contributions
// take precedence
function mergeAction(fs: ActionSpec, config: ActionSpec): ActionSpec {
  debug('Action from filesystem: %O', fs)
  debug('Action from config: %O', config)
  const result = Object.assign({}, fs, config)
  debug('Result of merge: %O', result)
  return result
}

// Probe the web directory.  We find all files even under subdirectories (no strays here).  However, if we turn out to be
// action-wrapping (which is not known at this point), file names with slashes will cause an error later.
function buildWebPart(webdir: string, build: string, reader: ProjectReader): Promise<DeployStructure> {
  if (!webdir) {
    return Promise.resolve(emptyStructure())
  } else {
    return readWebResources(webdir, reader).then(resources => {
      return { web: resources, webBuild: build, packages: [], strays: [] }
    })
  }
}

// Read the resources of the web directory
function readWebResources(webdir: string, reader: ProjectReader): Promise<WebResource[]> {
  debug('readWebResources for %s', webdir)
  return promiseFilesAndFilterFiles(webdir, reader).then((items: string[]) => {
    return convertToResources(items, webdir.length + 1)
  })
}

// Probe the packages directory
function buildActionsPart(pkgsdir: string, displayPath: string, includer: Includer, reader: ProjectReader): Promise<DeployStructure> {
  if (!pkgsdir) {
    return Promise.resolve(emptyStructure())
  } else {
    return buildPkgArray(pkgsdir, displayPath, includer, reader).then((values) => {
      const [strays, pkgs] = values
      return { web: [], packages: pkgs, strays: strays }
    })
  }
}

// Accumulate the arrays of PackageSpecs and Strays in the 'packages' directory
function buildPkgArray(pkgsDir: string, displayPath: string, includer: Includer, reader: ProjectReader): Promise<any> {
  debug('Building package array')
  return reader.readdir(pkgsDir).then((items: PathKind[]) => {
    items = filterFiles(items)
    const strays = items.filter(dirent => !dirent.isDirectory).map(dirent => dirent.name)
    const pkgNames = items.filter(dirent => dirent.isDirectory).map(dirent => dirent.name)
    const rdrs: Promise<PackageSpec>[] = []
    for (const name of pkgNames) {
      if (includer.isPackageIncluded(name, false)) {
        const pkgPath = path.join(pkgsDir, name)
        rdrs.push(readPackage(pkgPath, path.join(displayPath, name), name, includer, reader))
      }
    }
    return Promise.all([Promise.resolve(strays), Promise.all(rdrs)])
  })
}

// Read the contents of a directory defining a package.  By convention, actions not requiring a build step are stored directly in the
// package directory.  Those requiring a build are stored in a subdirectory.  The name of each action is the single file name (sans suffix)
// or the name of the subdirectory.
function readPackage(pkgPath: string, displayPath: string, pkgName: string, includer: Includer, reader: ProjectReader): Promise<PackageSpec> {
  debug("reading information for package '%s' with display path '%s'", pkgPath, displayPath)
  return reader.readdir(pkgPath).then((items: PathKind[]) => {
    items = filterFiles(items)
    const promises: Promise<ActionSpec>[] = []
    const seen = {}
    for (const item of items) {
      const file = path.join(pkgPath, item.name)
      const displayFile = path.join(displayPath, item.name)
      debug('item %s has display path %s', item.name, displayFile)
      if (!item.isDirectory) {
        // Directly deployable action not requiring a build.
        const { name, runtime, binary, zipped } = actionFileToParts(item.name)
        if (!includer.isActionIncluded(pkgName, name)) continue
        const before = seen[name]
        if (before) {
          throw duplicateName(name, before, runtime)
        }
        seen[name] = runtime
        promises.push(Promise.resolve({ name, file, displayFile, runtime, binary, zipped, package: pkgName }))
      } else if (item.isDirectory) {
        // Build-dependent action or renamed action
        if (!includer.isActionIncluded(pkgName, item.name)) continue
        const before = seen[item.name]
        if (before) {
          throw duplicateName(item.name, before, '*')
        }
        seen[item.name] = '*'
        promises.push(getBuildForAction(file, reader).then(build => {
          return { name: item.name, file, displayFile, build, package: pkgName }
        }))
      }
    }
    return Promise.all(promises)
  }).then((actions: ActionSpec[]) => {
    return { name: pkgName, actions: actions, shared: false }
  })
}

// Build an error indicating o duplicate action name.  This can happen if, e.g. you have both eval.js and eval.swift
// or if you have eval.js and an action directory called eval.
function duplicateName(actionName: string, formerUse: string, newUse: string) {
  const former = formerUse === '*' ? 'as a directory' : `with runtime '${formerUse}'`
  const present = newUse === '*' ? 'as a directory' : `with runtime '${newUse}'`
  return new Error(`The action name '${actionName}' appears twice, once ${former} and once ${present}`)
}

// Read the config file if present.  For convenience, the extra information not merged from elsewhere is tacked on here
function readConfig(configFile: string, envPath: string, filePath: string, includer: Includer, reader: ProjectReader,
  feedback: Feedback): Promise<DeployStructure> {
  if (!configFile) {
    debug('No config file found')
    const ans = Object.assign({}, emptyStructure())
    return Promise.resolve(ans)
  }
  debug('Reading config file')
  return loadProjectConfig(configFile, envPath, filePath, reader, feedback).then(config => trimConfigWithIncluder(config, includer))
    .catch(err => errorStructure(err))
}

// Given a DeployStructure with web and package sections, trim those sections according to the rules of an Includer
function trimConfigWithIncluder(config: DeployStructure, includer: Includer): DeployStructure {
  if (!includer.isWebIncluded) {
    config.web = []
    config.bucket = undefined
    config.actionWrapPackage = ''
  }
  if (config.packages) {
    const newPkgs: PackageSpec[] = []
    for (const pkg of config.packages) {
      if (includer.isPackageIncluded(pkg.name, false)) {
        if (pkg.actions) {
          pkg.actions = pkg.actions.filter(action => includer.isActionIncluded(pkg.name, action.name))
        }
        newPkgs.push(pkg)
      }
    }
    config.packages = newPkgs
  }
  return config
}
