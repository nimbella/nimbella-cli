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
import { DeployStructure, PackageSpec, ActionSpec, fileExtensionForRuntime } from '@nimbella/nimbella-deployer'
import { samples } from './samples'
import { branding } from '../NimBaseCommand'

// Contents of a "standard" .gitigore file
// Note that we do not attempt to list typical IDE and editor temporaries here.
// It is considered best practice for developers to list these in a personal global
// ignore file (`core.excludesfile` in the git config) and not in a committed .gitignore.
const gitignores = `.nimbella
__deployer__.zip
__pycache__/
node_modules
.DS_Store
`

// Working function used by project create
export async function createProject(project: string, flags: any, logger: any): Promise<void> {
  const { overwrite, language } = flags
  const { kind, sampleText } = languageToKindAndSample(language, logger)
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
  if (kind) {
    generateSample(kind, projectConfig, sampleText, samplePackage)
  }
  // Write the config.
  const data = yaml.safeDump(projectConfig)
  fs.writeFileSync(configFile, data)
  // Add the .gitignore
  fs.writeFileSync(gitignoreFile, gitignores)
  const msgs = [
    `A sample project called '${project}' was created for you.`,
    'You may deploy it by running the command shown on the next line:',
    `  ${branding.cmdName} project deploy ${project}`
  ]
  logger.logOutput({ status: 'Created', project: project }, msgs)
}

function createProjectPackage(samplePackage: string) {
  fs.mkdirSync(samplePackage, { recursive: true })
}

// Make a more fully populated config (with defaults filled in and comments)
// TODO we don't have an internal representation of comments, so we punt on that for the moment.
function configTemplate(): DeployStructure {
  const config: DeployStructure = { targetNamespace: '', cleanNamespace: false, bucket: {}, parameters: {}, packages: [] }
  const defPkg: PackageSpec = { name: 'sample', shared: false, clean: false, environment: {}, parameters: {}, annotations: {}, actions: [] }
  config.packages.push(defPkg)
  return config
}

// Convert a user-specified language name to a runtime kind plus a sample.
// Handle the error case of user requesting an unsupported language.
function languageToKindAndSample(language: string, logger: any): { kind: string, sampleText: string } {
  if (!language) {
    return { kind: undefined, sampleText: undefined } // normal flow: user did not request a sample
  } else {
    language = language.toLowerCase()
  }
  // TODO the following should be coordinated with the runtime table and some common source of samples used by playground,
  // cloud editor, and this code
  if (languages.includes(language)) { return { kind: language + ':default', sampleText: samples[language] } }
  logger.handleError(`${language} is not a supported language`)
}

// Generate a sample.   The sample is called 'hello'.
function generateSample(kind: string, config: DeployStructure, sampleText: string, samplePackage: string) {
  kind = mapLanguage(kind)
  const [runtime] = kind.split(':')
  const suffix = fileExtensionForRuntime(runtime, false)
  const actionDir = path.join(samplePackage, 'hello')
  fs.mkdirSync(actionDir, { recursive: true })
  const file = path.join(actionDir, `hello.${suffix}`)
  fs.writeFileSync(file, sampleText)
  const sampPkg = config.packages.find(pkg => pkg.name === 'sample')
  const action: ActionSpec = {
    name: 'hello',
    clean: false,
    binary: false,
    main: '',
    runtime: kind,
    web: true,
    webSecure: false,
    parameters: {},
    environment: {},
    annotations: {},
    limits: limitsFor(runtime)
  }
  sampPkg.actions.push(action)
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

function mapLanguage(kind: string) {
  const [language, variant] = kind.split(':')
  let runtime = language
  switch (language) {
  case 'js':
  case 'javascript':
    runtime = 'nodejs'
    break
  case 'ts':
    runtime = 'typescript'
    break
  case 'py':
    runtime = 'python'
    break
  case 'rb':
    runtime = 'ruby'
    break
  case 'rs':
    runtime = 'rust'
    break
  case 'golang':
    runtime = 'go'
    break
  default:
    break
  }
  return `${runtime}:${variant}`
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
