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
import { DeployStructure, PackageSpec, ActionSpec, fileExtensionForRuntime } from '@nimbella/nimbella-deployer'
import { samples } from './samples'

// Working function used by both create and update
export async function createOrUpdateProject(updating: boolean, args: any, flags: any, logger: any): Promise<void> {
  const { target, clean, config } = flags
  const { kind, sampleText } = languageToKindAndSample(flags.language, logger)
  let projectConfig: DeployStructure = config ? configTemplate() : (target || clean) ? {} : undefined
  const configFile = path.join(args.project, 'project.yml')
  const defaultPackage = path.join(args.project, 'packages', 'default')
  if (fs.existsSync(args.project)) {
    const isEmpty = fs.readdirSync(args.project).length === 0
    if (updating || flags.overwrite) {
      // TODO this code is not being exercised due to test above.  When it is re-enabled it will require change
      if (seemsToBeProject(args.project)) {
        if (fs.existsSync(configFile)) {
          const configContents = String(fs.readFileSync(configFile))
          if (configContents.includes('${')) {
            // TODO address how this can also work if the file contains symbolic substitutions.  At present there is no safe way of
            // auto-modifying such a file because symbols will not survive a load/store cycle as symbols (they will either break or be
            // resolved).
            logger.handleError('Current restriction: project update does not work if there are symbolic substitutions in the configuration')
          }
          projectConfig = yaml.safeLoad(configContents) as DeployStructure
        }
        if (kind && !fs.existsSync(defaultPackage)) {
          fs.mkdirSync(defaultPackage, { recursive: true })
        }
      } else {
        logger.handleError(`A directory or file '${args.project}' does not appear to be a project`)
      }
    } else if (isEmpty) {
      createProject(defaultPackage, args)
    } else if (seemsToBeProject(args.project)) {
      logger.handleError(`Cannot create project because '${args.project}' already exists in the file system, use '-o' to overwrite`)
    } else {
      logger.handleError(`Cannot create project because '${args.project}' already exists in the file system and is non empty`)
    }
  } else {
    // Create the project from scratch
    createProject(defaultPackage, args)
  }
  // Add material to the project.
  if (target) {
    // To remove a target, user specifies '' as the target
    projectConfig.targetNamespace = target
  }
  if (typeof clean === 'boolean') {
    // TODO does oclif actually distinguish absent from negated in this way?  Moot until we re-enable update
    projectConfig.cleanNamespace = clean
  }
  if (kind) {
    generateSample(kind, config ? projectConfig : undefined, sampleText, defaultPackage)
  }
  // (Re)write the config.  TODO: in the update case, in addition to the problem with symbols, rewriting the config will lose the comments
  if (projectConfig) {
    const data = yaml.safeDump(projectConfig)
    fs.writeFileSync(configFile, data)
  }

  if (updating) {
    logger.log(`The project '${args.project}' was updated.`)
  } else { // create or flags.overwrite
    logger.log(`A sample project called '${args.project}' was created for you.`)
    logger.log('You may deploy it by running the command shown on the next line:')
    logger.log(`  nim project deploy ${args.project}`)
  }
}

function createProject(defaultPackage: string, args: any) {
  fs.mkdirSync(defaultPackage, { recursive: true })
  const web = path.join(args.project, 'web')
  fs.mkdirSync(web)
}

// Make a more fully populated config (with defaults filled in and comments)
// TODO we don't have an internal representation of comments, so we punt on that for the moment.
function configTemplate(): DeployStructure {
  const config: DeployStructure = { targetNamespace: '', cleanNamespace: false, bucket: {}, parameters: {}, packages: [] }
  const defPkg: PackageSpec = { name: 'default', shared: false, clean: false, environment: {}, parameters: {}, annotations: {}, actions: [] }
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

// Generate a sample.   The sample is called 'hello'.   When we support update we will need to elaborate this when there are
// pre-existing actions called 'hello'
function generateSample(kind: string, config: DeployStructure | undefined, sampleText: string, defaultPackage: string) {
  kind = mapLanguage(kind)
  const [runtime] = kind.split(':')
  const suffix = fileExtensionForRuntime(runtime, false)
  const file = path.join(defaultPackage, `hello.${suffix}`)
  fs.writeFileSync(file, sampleText)
  if (config) {
    // Here we assume if we are given a config it is a full template already containing a default package
    const defPkg = config.packages.find(pkg => pkg.name === 'default')
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
      limits: {}
    }
    defPkg.actions.push(action)
  }
}

function mapLanguage(kind: string) {
  const [language, variant] = kind.split(':')
  let runtime = language
  switch (language) {
  case 'js':
  case 'javascript':
    runtime = 'nodejs'
    break
  case 'cs':
  case 'csharp':
  case 'vb':
    runtime = 'dotnet'
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

export const languages = ['cs', 'csharp', 'deno', 'go', 'golang', 'java', 'js', 'javascript', 'php', 'py', 'python', 'rb', 'ruby', 'rs', 'rust', 'swift', 'ts', 'typescript']
export const runtimes = ['ballerina', 'deno', 'dotnet', 'go', 'java', 'nodejs', 'php', 'python', 'ruby', 'rust', 'swift']
