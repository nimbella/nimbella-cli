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

import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import * as rimraf from 'rimraf'
import {
  DeployStructure, PackageSpec, ActionSpec, fileExtensionForRuntime, initRuntimes,
  renameActionsToFunctions, isValidRuntime
} from '@nimbella/nimbella-deployer'
import { samples } from './samples'
import { branding } from '../NimBaseCommand'

// Contents of a "standard" .gitigore file
// Note that we do not attempt to list typical IDE and editor temporaries here.
// It is considered best practice for developers to list these in a personal global
// ignore file (`core.excludesfile` in the git config) and not in a committed .gitignore.
const gitignores = `.nimbella
.deployed
__deployer__.zip
__pycache__/
node_modules
package-lock.json
.DS_Store
`

const ignoreForTypescript = 'lib/\n'

// A canned package.json for a minimal typescript project
const packageJsonForTypescript = `{
  "main": "lib/hello.js",
  "devDependencies": {
    "typescript": "^4"
  },
  "scripts": {
    "build": "tsc -b"
  }
}
`

// A canned tsconfig.json for typescript project
const tsconfigJSON = `{
  "compilerOptions": {
    "baseUrl": ".",
    "esModuleInterop": true,
    "importHelpers": true,
    "module": "commonjs",
    "outDir": "lib",
    "rootDir": "src",
    "target": "es2019"
  },
  "include": [
    "src/**/*"
  ]
}
`

// Working function used by project create
export async function createProject(project: string, flags: any, logger: any): Promise<void> {
  const { overwrite, language } = flags
  const { kind, sampleText, ts } = languageToKindAndSample(language, logger)
  const validKind = await isKindAValidRuntime(kind)
  if (!validKind) {
    logger.handleError(`${language} is not a supported language`)
  }
  const projectConfig: DeployStructure = configTemplate()
  const configFile = path.join(project, 'project.yml')
  const gitignoreFile = path.join(project, '.gitignore')
  const samplePackage = path.join(project, 'packages', 'sample')
  if (fs.existsSync(project) && !(fs.readdirSync(project).length === 0)) {
    if (overwrite) {
      rimraf.sync(project)
    } else {
      logger.handleError(`Cannot create project because '${project}' already exists in the file system. Use '-o' to overwrite`)
    }
  }
  createProjectPackage(samplePackage)
  const actionDir = generateSample(kind, projectConfig, sampleText, samplePackage, ts)
  // Write the config.
  renameActionsToFunctions(projectConfig)
  const data = yaml.safeDump(projectConfig)
  fs.writeFileSync(configFile, data)
  // Add the .gitignore
  const ignores = gitignores + (ts ? ignoreForTypescript : '')
  fs.writeFileSync(gitignoreFile, ignores)
  // Add typescript-specific information
  if (ts) {
    const pjFile = path.join(actionDir, 'package.json')
    fs.writeFileSync(pjFile, packageJsonForTypescript)
    const tscFile = path.join(actionDir, 'tsconfig.json')
    fs.writeFileSync(tscFile, tsconfigJSON)
    const includeFile = path.join(actionDir, '.include')
    fs.writeFileSync(includeFile, 'lib\n')
  }
  const msgs = [
    `A sample project called '${project}' was created for you.`,
    'You may deploy it by running the command shown on the next line:',
    `  ${branding.cmdName} project deploy ${project}`
  ]
  logger.logOutput({ status: 'Created', project: project }, msgs)
}

async function isKindAValidRuntime(kind: string): Promise<boolean> {
  try {
    const runtimes = await initRuntimes()
    return isValidRuntime(runtimes, kind)
  } catch (err) {
    // We can't get the runtimes from the controller, hence we can't check, so we optimistically assume
    // it's ok.  TODO perhaps we should issue a warning for this case?
    return true
  }
}

function createProjectPackage(samplePackage: string) {
  fs.mkdirSync(samplePackage, { recursive: true })
}

// Make a more fully populated config (with defaults filled in and comments)
// TODO we don't have an internal representation of comments, so we punt on that for the moment.
function configTemplate(): DeployStructure {
  const config: DeployStructure = { environment: {}, parameters: {}, packages: [] }
  const defPkg: PackageSpec = { name: 'sample', environment: {}, parameters: {}, annotations: {}, actions: [] }
  config.packages.push(defPkg)
  return config
}

// Convert a user-specified language name to a runtime kind plus a sample.
// Handle the error case of user requesting an unsupported language.
function languageToKindAndSample(language: string, logger: any): { kind: string, sampleText: string, ts: boolean } {
  language = language.toLowerCase()
  if (!languages.includes(language)) {
    logger.handleError(`${language} is not a supported language`)
  }
  const { kind, ts } = languageToKind(language)
  return { kind, sampleText: samples[language], ts }
}

// Generate a sample.   The sample is called 'hello'.
function generateSample(kind: string, config: DeployStructure, sampleText: string, samplePackage: string, ts: boolean): string {
  const [runtime] = kind.split(':')
  const suffix = ts ? 'ts' : fileExtensionForRuntime(runtime, false)
  const actionDir = path.join(samplePackage, 'hello')
  fs.mkdirSync(actionDir, { recursive: true })
  let file: string
  if (ts) {
    const srcDir = path.join(actionDir, 'src')
    fs.mkdirSync(srcDir)
    file = path.join(srcDir, `hello.${suffix}`)
  } else {
    file = path.join(actionDir, `hello.${suffix}`)
  }
  fs.writeFileSync(file, sampleText)
  const sampPkg = config.packages.find(pkg => pkg.name === 'sample')
  const action: ActionSpec = {
    name: 'hello',
    binary: false,
    main: '',
    runtime: kind,
    web: true,
    parameters: {},
    environment: {},
    annotations: {},
    limits: limitsFor(runtime)
  }
  sampPkg.actions.push(action)
  return actionDir
}

// Set time limits based on the runtime.  Most runtimes are fine with the default
function limitsFor(runtime: string): any {
  switch (runtime) {
  case 'typescript':
  case 'swift':
  case 'java':
    return { timeout: 5000 }
  }
  return {}
}

function languageToKind(language: string) {
  let runtime = language
  let ts = false
  switch (language) {
  case 'ts':
  case 'typescript':
    ts = true
    runtime = 'nodejs'
    break
  case 'js':
  case 'javascript':
    runtime = 'nodejs'
    break
  case 'py':
    runtime = 'python'
    break
  //  case 'rb':
  //    runtime = 'ruby'
  //    break
  //  case 'rs':
  //    runtime = 'rust'
  //    break
  case 'golang':
    runtime = 'go'
    break
  default:
    break
  }
  return { kind: `${runtime}:default`, ts }
}

// Test whether a path in the file system is a project based on some simple heuristics.  The path is known to exist.
export function seemsToBeProject(path: string): boolean {
  if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
    const contents = fs.readdirSync(path, { withFileTypes: true })
    for (const entry of contents) {
      if (entry.name === 'project.yml' && entry.isFile()) { return true }
      if (entry.name === 'packages' && entry.isDirectory()) { return true }
      if (entry.name === 'web' && entry.isDirectory()) { return true }
    }
  }
  return false
}

export const languages = ['deno', 'go', 'golang', 'java', 'js', 'javascript', 'php', 'py', 'python', 'rb', 'ruby', 'rs', 'rust', 'swift', 'ts', 'typescript']
export const runtimes = ['ballerina', 'deno', 'go', 'java', 'nodejs', 'php', 'python', 'ruby', 'rust', 'swift']
