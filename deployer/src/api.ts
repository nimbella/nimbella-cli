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

// Contains the main public (library) API of the deployer (some exports in 'util' may also be used externally but are incidental)

import { cleanOrLoadVersions, doDeploy, actionWrap, cleanPackage } from './deploy'
import { DeployStructure, DeployResponse, PackageSpec, OWOptions, WebResource, Credentials, Flags, Includer, Feedback, DefaultFeedback } from './deploy-struct'
import { readTopLevel, buildStructureParts, assembleInitialStructure } from './project-reader'
import {
  isTargetNamespaceValid, wrapError, wipe, saveUsFromOurselves, writeProjectStatus, getTargetNamespace,
  checkBuildingRequirements, errorStructure, getBestProjectName, inBrowser
} from './util'
import { openBucketClient } from './deploy-to-bucket'
import { buildAllActions, buildWeb } from './finder-builder'
import * as openwhisk from 'openwhisk'
import { getCredentialsForNamespace, getCredentials, Persister, recordNamespaceOwnership } from './credentials'
import { makeIncluder } from './includer'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:api')

// Initialize the API by 1. purging existing __OW_ entries from the environment, 2.  setting __OW_USER_AGENT, 3. returning a map of
// entries that were purged.   Also saves the __OW_NAMESPACE and __OW_API_HOST values in the environment, renamed, for the special
// cases where there is no credential store but certain code paths still must work.  An example is the slice reader.
export function initializeAPI(userAgent: string): {[key: string]: string} {
  const result: Record<string, string> = {}
  for (const item in process.env) {
    if (item.startsWith('__OW_')) {
      result[item] = process.env[item]
      delete process.env[item]
    }
  }
  process.env.__OW_USER_AGENT = userAgent
  // Careful with these transfers.  Assigning a value to the env always casts to string (even undefined -> "undefined")
  if (result.__OW_NAMESPACE) {
    process.env.savedOW_NAMESPACE = result.__OW_NAMESPACE
  }
  if (result.__OW_API_HOST) {
    process.env.savedOW_API_HOST = result.__OW_API_HOST
  }
  return result
}

// Get a vaguely valid user agent string.  Hopefully, this was set in the environment during initialize.  But, we use some fallbacks if not.
// It is not necessary to call this function when using the OW client because it will respect __OW_USER_AGENT directly.  It is used
// when using other web APIs in order to set a valid and possibly useful value in the user-agent header.
export function getUserAgent(): string {
  const ans = process.env.__OW_USER_AGENT
  return ans || (inBrowser ? 'nimbella-workbench' : 'nimbella-cli')
}

// Deploy a disk-resident project given its path and options to pass to openwhisk.  The options are merged
// with those in the config; the result must include api or apihost, and must include api_key.
export function deployProject(path: string, owOptions: OWOptions, credentials: Credentials|undefined, persister: Persister, flags: Flags): Promise<DeployResponse> {
  debug('deployProject invoked with incremental %s', flags.incremental)
  return readPrepareAndBuild(path, owOptions, credentials, persister, flags).then(spec => {
    if (spec.error) {
      debug('An error was caught prior to %O:', spec.error)
      return Promise.resolve(wrapError(spec.error, undefined))
    }
    return deploy(spec)
  })
}

// Combines the read, prepare, and build phases but does not deploy
export function readPrepareAndBuild(path: string, owOptions: OWOptions, credentials: Credentials, persister: Persister,
  flags: Flags, userAgent?: string, feedback?: Feedback): Promise<DeployStructure> {
  return readAndPrepare(path, owOptions, credentials, persister, flags, undefined, feedback).then(spec => spec.error ? spec
    : buildProject(spec))
}

// Combines the read and prepare phases but does not build or deploy
export function readAndPrepare(path: string, owOptions: OWOptions, credentials: Credentials, persister: Persister,
  flags: Flags, userAgent?: string, feedback?: Feedback): Promise<DeployStructure> {
  const includer = makeIncluder(flags.include, flags.exclude)
  return readProject(path, flags.env, includer, flags.remoteBuild, feedback).then(spec => spec.error ? spec
    : prepareToDeploy(spec, owOptions, credentials, persister, flags))
}

// Perform deployment from a deploy structure.  The 'cleanOrLoadVersions' step is currently folded into this step
export function deploy(todeploy: DeployStructure): Promise<DeployResponse> {
  debug('Starting deploy')
  return cleanOrLoadVersions(todeploy).then(doDeploy).then(results => {
    if (!todeploy.githubPath) {
      const statusDir = writeProjectStatus(todeploy.filePath, results, todeploy.includer.isIncludingEverything())
      if (statusDir && !todeploy.slice) {
        todeploy.feedback.progress(`Deployment status recorded in '${statusDir}'`)
      }
    }
    if (!results.namespace && todeploy.credentials) {
      results.namespace = todeploy.credentials.namespace
    }
    return results
  })
}

// Read the information contained in the project, initializing the DeployStructure
export async function readProject(projectPath: string, envPath: string, includer: Includer, requestRemote: boolean,
  feedback: Feedback = new DefaultFeedback()): Promise<DeployStructure> {
  debug('Starting readProject, projectPath=%s, envPath=%s', projectPath, envPath)
  let ans: DeployStructure
  try {
    const topLevel = await readTopLevel(projectPath, envPath, includer, false, feedback)
    const parts = await buildStructureParts(topLevel)
    ans = assembleInitialStructure(parts)
  } catch (err) {
    return errorStructure(err)
  }
  debug('evaluating the just-read project: %O', ans)
  let needsLocalBuilds: boolean
  try {
    needsLocalBuilds = await checkBuildingRequirements(ans, requestRemote)
    debug('needsLocalBuilds=%s', needsLocalBuilds)
  } catch (err) {
    return errorStructure(err)
  }
  if (needsLocalBuilds && ans.reader.getFSLocation() === null) {
    debug("project '%s' will be re-read and cached because it's a github project that needs local building", projectPath)
    if (inBrowser) {
      return errorStructure(new Error(`Project '${projectPath}' cannot be deployed from the cloud because it requires building`))
    }
    try {
      const topLevel = await readTopLevel(projectPath, envPath, includer, true, feedback)
      const parts = await buildStructureParts(topLevel)
      ans = assembleInitialStructure(parts)
    } catch (err) {
      return errorStructure(err)
    }
  }
  return ans
}

// 'Build' the project by running the "finder builder" steps in each action-as-directory and in the web directory
export function buildProject(project: DeployStructure): Promise<DeployStructure> {
  debug('Starting buildProject with spec %O', project)
  let webPromise: Promise<WebResource[]|Error>
  project.sharedBuilds = { }
  if (project.webBuild) {
    webPromise = buildWeb(project).catch(err => Promise.resolve(err))
  }
  const actionPromise: Promise<PackageSpec[]> = buildAllActions(project)
  if (webPromise) {
    if (actionPromise) {
      return Promise.all([webPromise, actionPromise]).then(result => {
        const [web, packages] = result
        if (web instanceof Error) {
          project.webBuildError = web
        } else {
          project.web = web
        }
        project.packages = packages
        return project
      }).catch(err => errorStructure(err))
    } else {
      return webPromise.then(web => {
        if (web instanceof Error) {
          project.webBuildError = web
        } else {
          project.web = web
        }
        return project
      }).catch(err => errorStructure(err))
    }
  } else if (actionPromise) {
    return actionPromise.then(packages => {
      project.packages = packages
      return project
    }).catch(err => errorStructure(err))
  } else {
    return Promise.resolve(project)
  }
}

// Prepare a DeployStruct for deployment.
// 1.  Ensure that we are using the right credentials
// 2.  Merge credentials and user-specified OWOptions that were not necessarily part of the credentials.
// 3.  Open the OW and bucket client handles to ensure they are valid before the (possibly extensive) build step is performed.
//    Validation includes the optional check on the target namespace; even if it came from the credentials it might no longer be valid.
// 4.  Do action wrapping of web resources.  This creates additional actions in the final deployment.  The original web resources
//    are not deleted but are not deployed as such.
export async function prepareToDeploy(inputSpec: DeployStructure, owOptions: OWOptions, credentials: Credentials, persister: Persister,
  flags: Flags): Promise<DeployStructure> {
  debug('Starting prepare with spec: %O', inputSpec)
  // 0. Handle slice.  In that case, credentials and flags come from the DeployStructure
  if (inputSpec.slice) {
    debug('Retrieving credentials and flags from spec for slice')
    credentials = inputSpec.credentials
    flags = inputSpec.flags
  }
  // 1.  Acquire credentials if not already present
  let isTest = false
  let isProduction = false
  if (!credentials) {
    debug('Finding credentials locally')
    let namespace: string
    if (typeof inputSpec.targetNamespace === 'string') {
      namespace = inputSpec.targetNamespace
    } else if (inputSpec.targetNamespace) {
      const { test, production } = inputSpec.targetNamespace // previously validated
      if (flags.production) {
        if (production) {
          namespace = production
          isProduction = true
        } else {
          return errorStructure(new Error('The production flag was specified but there is no production namespace'))
        }
      } else {
        if (test) {
          namespace = test
          isTest = true
        } else {
          return errorStructure(new Error('The production flag was not specified and there is no test namespace'))
        }
      }
    }
    if (namespace) {
      // The config specified a target namespace so attempt to use it.
      debug('Retrieving specific credentials for namespace %s', namespace)
      credentials = await getCredentialsForNamespace(namespace, owOptions.apihost, persister)
    } else {
      // There is no target namespace so get credentials for the current one
      let badCredentials: Error
      debug('Attempting to get credentials for current namespace')
      credentials = await getCredentials(persister).catch(err => {
        badCredentials = err
        return undefined
      })
      if (badCredentials) {
        debug('Could not get credentials, returning error structure with %O', badCredentials)
        return errorStructure(badCredentials)
      }
    }
  }
  debug('owOptions: %O', owOptions)
  debug('credentials.ow: %O', credentials.ow)
  // We have valid credentials but now we must check that we are allowed to deploy to the namespace according to the ownership rules.
  if (credentials.project) {
    const apparentProject = getBestProjectName(inputSpec)
    if (credentials.project !== apparentProject) {
      return errorStructure(new Error(`Deployment to namespace '${credentials.namespace}' must be from project '${credentials.project}'`))
    }
    if (isTest && credentials.production) {
      return errorStructure(new Error(
        `Namespace '${credentials.namespace}' is a production namespace but 'project.yml' declares it as a test namespace`))
    }
    if (isProduction && !credentials.production) {
      return errorStructure(new Error(
        `Namespace '${credentials.namespace}' is a test namespace but 'project.yml' declares it as a production namespace`))
    }
  }
  // Record ownership if it is declared.  At this point we know it is legal and non-conflicting.
  if (isTest || isProduction) {
    recordNamespaceOwnership(getBestProjectName(inputSpec), credentials.namespace, credentials.ow.apihost, isProduction, persister)
  }
  // Merge and save credentials information
  const wskoptions = Object.assign({}, credentials.ow, owOptions || {})
  debug('wskoptions" %O', wskoptions)
  inputSpec.credentials = credentials
  debug('prepareToDeploy merging flags: %O', flags)
  inputSpec.flags = flags
  debug('Options merged')
  // 3.  Open handles
  const needsBucket = inputSpec.web && inputSpec.web.length > 0 && !inputSpec.actionWrapPackage && !flags.webLocal
  if (needsBucket && !credentials.storageKey) {
    return errorStructure(new Error(
      `Deployment of web content to namespace '${credentials.namespace}' requires file store access but is not enabled`))
  }
  debug('Auth sufficiency established')
  inputSpec.owClient = openwhisk(wskoptions)
  if (!credentials.namespace) {
    credentials.namespace = await getTargetNamespace(inputSpec.owClient)
  } else {
    await isTargetNamespaceValid(inputSpec.owClient, credentials.namespace)
  }
  debug('Target namespace validated')
  if (!flags.production && saveUsFromOurselves(credentials.namespace, credentials.ow.apihost)) {
    return errorStructure(new Error(
      `To deploy to namespace '${credentials.namespace}' on host '${credentials.ow.apihost}' you must specify the '--production' flag`))
  }
  debug('Sensitive project/namespace guard passed')
  if (needsBucket) {
    let error: Error
    const bucketClient = await openBucketClient(credentials, inputSpec.bucket)
      .catch(origError => {
        debug('Error creating bucket client: %O', origError)
        error = origError // Let it flow up to displayError where it will be improved
        return undefined
      })
    if (error) {
      return errorStructure(error)
    }
    inputSpec.bucketClient = bucketClient
  }
  debug('Bucket client created')
  // 4.  Action wrapping
  const { web, packages } = inputSpec
  if (web && web.length > 0 && inputSpec.actionWrapPackage) {
    try {
      const wrapPackage = inputSpec.actionWrapPackage
      const wrapping = web.map(res => {
        if (!res.mimeType) {
          throw new Error(`Could not deploy web resource ${res.filePath}; mime type cannot be determined`)
        }
        return actionWrap(res, inputSpec.reader, wrapPackage)
      })
      return Promise.all(wrapping).then(wrapped => {
        // If wrapPackage is already in the inputSpec, add the new actions to it.  Otherwise, make a new PackageSpec
        const existing: PackageSpec[] = packages.filter(pkg => pkg.name === wrapPackage)
        if (existing.length === 0) {
          packages.push({ name: wrapPackage, actions: wrapped, shared: false })
        } else {
          const modified = existing[0].actions.concat(wrapped)
          existing[0].actions = modified
        }
        return inputSpec
      })
    } catch (err) {
      return errorStructure(err)
    }
  } else {
    debug('returning spec %O', inputSpec)
    return Promise.resolve(inputSpec)
  }
}

// Utility to convert errors into useful messages.   Usually, this just means getting the message field from the error but there
// is logic to recognize the particular error pattern used by OW
export function getMessageFromError(err: any): string {
  // Although we attempt to say that all errors have type Error, in the loosy-goosy untyped world of Javascript this is easily violated.
  // Sometimes 'err' is just a string
  if (typeof err === 'string') {
    return err
  }
  // Pattern match against the OW error pattern
  if (err.error && err.error.error && err.error.code) {
    return '[OpenWhisk] ' + err.error.error
  }
  // Default case
  return err.message
}

// Wipe a namespace of everything except its activations (the activations cannot be wiped via the public API)
export async function wipeNamespace(host: string, auth: string): Promise<void> {
  debug('Requested wipe-namespace function with host %s and auth %s', host, auth)
  const init: OWOptions = { apihost: host, api_key: auth }
  const client = openwhisk(init)
  debug('Client opened')
  return wipe(client)
}

// Completely remove a package including its contained actions
export async function wipePackage(name: string, host: string, auth: string): Promise<openwhisk.Package> {
  debug("wipePackage invoked with name='%s', host='%s', auth='%s", name, host, auth)
  const init: OWOptions = { apihost: host, api_key: auth }
  const client = openwhisk(init)
  return cleanPackage(client, name, undefined)
}
