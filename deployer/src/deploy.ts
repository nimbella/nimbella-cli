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

import {
  DeployStructure, DeployResponse, ActionSpec, PackageSpec, WebResource, BucketSpec, DeployerAnnotation, VersionEntry,
  ProjectReader, OWOptions, KeyVal
} from './deploy-struct'
import {
  combineResponses, wrapError, wrapSuccess, keyVal, emptyResponse,
  getDeployerAnnotation, straysToResponse, wipe, makeDict, digestPackage, digestAction, loadVersions
} from './util'
import * as openwhisk from 'openwhisk'
import { Bucket } from '@google-cloud/storage'
import { deployToBucket, cleanBucket } from './deploy-to-bucket'
import { ensureWebLocal, deployToWebLocal } from './web-local'
import * as rimrafOrig from 'rimraf'
import { promisify } from 'util'
import * as makeDebug from 'debug'

const debug = makeDebug('nim:deployer:deploy')
const rimraf = promisify(rimrafOrig)

//
// Main deploy logic, excluding that assigned to more specialized files
//

// Clean resources as requested unless the 'incremental', 'include' or 'exclude' is specified.
// For 'incremental', cleaning is skipped entirely.  Otherwise, cleaning is skipped for portions of
// the project not included in the deployment.  Note: there should always be an Includer by the time we reach here.
export async function cleanOrLoadVersions(todeploy: DeployStructure): Promise<DeployStructure> {
  if (todeploy.flags.incremental) {
    // Incremental deployment requires the versions up front to have access to the form hashes
    todeploy.versions = loadVersions(todeploy.filePath, todeploy.credentials.namespace, todeploy.credentials.ow.apihost)
  } else {
    if (todeploy.includer.isWebIncluded && (todeploy.cleanNamespace || (todeploy.bucket && todeploy.bucket.clean))) {
      if (todeploy.bucketClient) {
        const warn = await cleanBucket(todeploy.bucketClient, todeploy.bucket, todeploy.credentials.ow)
        if (warn) {
          todeploy.feedback.warn(warn)
        }
      } else if (todeploy.flags.webLocal) {
        await rimraf(todeploy.flags.webLocal)
      }
    }
    if (todeploy.cleanNamespace && todeploy.includer.isIncludingEverything()) {
      await wipe(todeploy.owClient)
    } else {
      await cleanActionsAndPackages(todeploy)
    }
  }
  return Promise.resolve(todeploy)
}

// Do the actual deployment (after testing the target namespace and cleaning)
export function doDeploy(todeploy: DeployStructure): Promise<DeployResponse> {
  let webLocal
  if (todeploy.flags.webLocal) {
    webLocal = ensureWebLocal(todeploy.flags.webLocal)
  }
  const webPromises = todeploy.web.map(res => deployWebResource(res, todeploy.actionWrapPackage, todeploy.bucket, todeploy.bucketClient,
    todeploy.flags.incremental ? todeploy.versions : undefined, webLocal, todeploy.reader, todeploy.credentials.ow))
  return getDeployerAnnotation(todeploy.filePath, todeploy.githubPath).then(deployerAnnot => {
    const actionPromises = todeploy.packages.map(pkg => deployPackage(pkg, todeploy.owClient, deployerAnnot, todeploy.parameters,
      todeploy.environment, todeploy.cleanNamespace, todeploy.flags.incremental ? todeploy.versions : undefined, todeploy.reader))
    const strays = straysToResponse(todeploy.strays)
    return Promise.all(webPromises.concat(actionPromises)).then(responses => {
      responses.push(strays)
      const response = combineResponses(responses)
      response.apihost = todeploy.credentials.ow.apihost
      if (!response.namespace) { response.namespace = todeploy.credentials.namespace }
      return response
    })
  })
}

// Look for 'clean' flags in the actions and packages and perform the cleaning.
function cleanActionsAndPackages(todeploy: DeployStructure): Promise<DeployStructure> {
  if (!todeploy.packages) {
    return Promise.resolve(todeploy)
  }
  const promises: Promise<any>[] = []
  for (const pkg of todeploy.packages) {
    const defaultPkg = pkg.name === 'default'
    if (pkg.clean && !defaultPkg && todeploy.includer.isPackageIncluded(pkg.name)) {
      // We should have headed off 'clean' of the default package already.  The added test is just in case
      promises.push(cleanPackage(todeploy.owClient, pkg.name, todeploy.versions))
    } else if (pkg.actions) {
      const prefix = defaultPkg ? '' : pkg.name + '/'
      for (const action of pkg.actions) {
        if (action.clean && todeploy.includer.isActionIncluded(pkg.name, action.name)) {
          delete todeploy.versions.actionVersions[action.name]
          promises.push(todeploy.owClient.actions.delete(prefix + action.name).catch(() => undefined))
        }
      }
    }
  }
  return Promise.all(promises).then(() => todeploy)
}

// Clean a package by first deleting its contents then deleting the package itself
// The 'versions' argument can be undefined, allowing this to be used to delete packages without a project context
export async function cleanPackage(client: openwhisk.Client, name: string, versions: VersionEntry): Promise<openwhisk.Package> {
  debug('Cleaning package %s', name)
  while (true) {
    const pkg = await client.packages.get({ name }).catch(() => undefined)
    if (!pkg) {
      return { name }
    }
    if (!pkg.actions || pkg.actions.length === 0) {
      debug('No more actions, removing package')
      if (versions && versions.packageVersions) { delete versions.packageVersions[name] }
      return client.packages.delete({ name })
    }
    for (const action of pkg.actions) {
      debug('deleting action %s', action.name)
      if (versions && versions.actionVersions) { delete versions.actionVersions[action.name] }
      await client.actions.delete({ name: name + '/' + action.name })
    }
  }
}

// Deploy a web resource.  If this is invoked, we can assume that at least one of actionWrapPackage, bucketClient,
// or webLocal is defined.  If actionWrapPackage is provided, this step is a no-op since the actual action wrapping
// will have been done in the prepareToDeploy step and the fact of action wrapping will be part of the final status
// message for deploying the action.  If webLocal is specified, the deploy is just a copy to the specified location,
// which is assumed to exist (it should have been created already).  Otherwise, if bucketClient is specified, this
// is a traditional deploy to the bucket.  Otherwise (none specified) it is an error.
export function deployWebResource(res: WebResource, actionWrapPackage: string, spec: BucketSpec,
  bucketClient: Bucket, versions: VersionEntry, webLocal: string, reader: ProjectReader, owOptions: OWOptions): Promise<DeployResponse> {
  // We can rely on the fact that prepareToDeploy would have rejected the deployment if action wrapping failed.
  if (actionWrapPackage) {
    return Promise.resolve(emptyResponse())
  } else if (webLocal) {
    return deployToWebLocal(res, webLocal, spec)
  } else if (bucketClient) {
    return deployToBucket(res, bucketClient, spec, versions, reader, owOptions)
  } else {
    return Promise.resolve(wrapError(new Error(`No bucket client and/or bucket spec for '${res.simpleName}'`), 'web resources'))
  }
}

// Wrap a web resource in an action.   Returns a promise of the resulting ActionSpec
export function actionWrap(res: WebResource, reader: ProjectReader): Promise<ActionSpec> {
  return reader.readFileContents(res.filePath).then(data => {
    let contents = String(data)
    contents = contents.split('\\').join('\\\\').split('`').join('\\`')
    const code = `
const body = \`${contents}\`

function main() {
    return {
       statusCode: 200,
       headers: { 'Content-Type': '${res.mimeType}' },
       body: body
    }
}`
    const name = res.simpleName.endsWith('.html') ? res.simpleName.replace('.html', '') : res.simpleName
    return { name, file: res.filePath, runtime: 'nodejs:default', binary: false, web: true, code, wrapping: res.filePath }
  })
}

// Deploy a package, then deploy everything in it (currently just actions)
export async function deployPackage(pkg: PackageSpec, wsk: openwhisk.Client, deployerAnnot: DeployerAnnotation,
  projectParams: openwhisk.Dict, projectEnv: openwhisk.Dict, namespaceIsClean: boolean, versions: VersionEntry,
  reader: ProjectReader): Promise<DeployResponse> {
  if (pkg.name === 'default') {
    return Promise.all(pkg.actions.map(action => deployAction(action, wsk, '', deployerAnnot, namespaceIsClean, versions, reader)))
      .then(combineResponses)
  }
  // Check whether the package metadata needs to be deployed; if so, deploy it.  If not, make a vacuous response with the existing package
  // VersionInfo.   That is needed so that the new versions.json will have the information in it.
  let pkgResponse: DeployResponse
  const digest = digestPackage(pkg)
  if (versions && versions.packageVersions && versions.packageVersions[pkg.name] && digest === versions.packageVersions[pkg.name].digest) {
    const packageVersions = {}
    packageVersions[pkg.name] = versions.packageVersions[pkg.name]
    pkgResponse = { successes: [], failures: [], ignored: [], packageVersions, actionVersions: {}, namespace: undefined }
  } else {
    let former: openwhisk.Package
    if (!pkg.clean && !namespaceIsClean) {
      former = await wsk.packages.get({ name: pkg.name }).catch(() => undefined)
    }
    const oldAnnots = former && former.annotations ? makeDict(former.annotations) : {}
    delete oldAnnots.deployerAnnot // remove unwanted legacy from undetected earlier error
    const deployer = deployerAnnot
    deployer.digest = digest.substring(0, 8)
    const annotDict = Object.assign({}, oldAnnots, pkg.annotations, { deployer })
    const annotations = keyVal(annotDict)
    const mergedParams = Object.assign({}, projectParams, pkg.parameters)
    const mergedEnv = Object.assign({}, projectEnv, pkg.environment)
    const params = encodeParameters(mergedParams, mergedEnv)
    const owPkg: openwhisk.Package = { parameters: params, annotations, publish: pkg.shared }
    await wsk.packages.update({ name: pkg.name, package: owPkg }).then(result => {
      const packageVersions = {}
      packageVersions[pkg.name] = { version: result.version, digest }
      pkgResponse = { successes: [], failures: [], ignored: [], packageVersions, actionVersions: {}, namespace: result.namespace }
    }).catch(err => {
      pkgResponse = wrapError(err, `package '${pkg.name}'`)
    })
  }
  // Now deploy (or skip) the actions of the package
  const prefix = pkg.name + '/'
  const promises = pkg.actions.map(action => deployAction(action, wsk, prefix, deployerAnnot, pkg.clean || namespaceIsClean,
    versions, reader)).concat(Promise.resolve(pkgResponse))
  return Promise.all(promises).then(responses => combineResponses(responses))
}

// Deploy an action
function deployAction(action: ActionSpec, wsk: openwhisk.Client, prefix: string, deplAnnot: DeployerAnnotation,
  actionIsClean: boolean, versions: VersionEntry, reader: ProjectReader): Promise<DeployResponse> {
  if (action.code) {
    return deployActionFromCode(action, prefix, action.code, wsk, deplAnnot, actionIsClean, versions)
  }
  const codeFile = action.file
  return reader.readFileContents(codeFile).then(data => {
    const code = action.binary ? data.toString('base64') : String(data)
    return code
  }).then((code: string) => deployActionFromCode(action, prefix, code, wsk, deplAnnot, actionIsClean, versions))
    .catch(err => Promise.resolve(wrapError(err, `action '${prefix}${action.name}'`)))
}

function encodeParameters(normalParms: openwhisk.Dict, envParms: openwhisk.Dict): KeyVal[] {
  let ans: KeyVal[] = []
  if (normalParms) {
    ans = keyVal(normalParms)
  }
  if (envParms) {
    const envs = keyVal(envParms)
    envs.forEach(env => {
      env.init = true
    })
    ans = ans.concat(envs)
  }
  return ans
}

// Deploy an action when the code has already been read from a file or constructed programmatically.  The code and file members
// of the ActionSpec are ignored but the rest of the ActionSpec is intepreted here.
async function deployActionFromCode(action: ActionSpec, prefix: string, code: string, wsk: openwhisk.Client, deployerAnnot: DeployerAnnotation,
  actionIsClean: boolean, versions: VersionEntry): Promise<DeployResponse> {
  const name = prefix + action.name
  const runtime = action.runtime
  if (!runtime) {
    return Promise.resolve(wrapError(new Error(`Action '${name}' not deployed: runtime type could not be determined`), `action ${name}`))
  }
  // Check whether the action needs to be deployed; if so, deploy it.  If not, make a vacuous response with the existing package
  // VersionInfo.   That is needed so that the new versions.json will have the information in it.
  const digest = digestAction(action, code)
  if (versions && versions.actionVersions && versions.actionVersions[name] && digest === versions.actionVersions[name].digest) {
    // Skipping deployment
    const actionVersions = {}
    actionVersions[name] = versions.actionVersions[name]
    return Promise.resolve(wrapSuccess(name, 'action', true, undefined, actionVersions, undefined))
  }
  // Will be deployed
  // Compute the annotations that we will definitely be adding
  const annotations = action.annotations || {}
  const deployer = deployerAnnot
  deployer.digest = digest.substring(0, 8)
  deployer.zipped = action.zipped
  annotations.deployer = deployer
  if (action.web === true) {
    annotations['web-export'] = true
    annotations.final = true
    annotations['raw-http'] = false
  } else if (action.web === 'raw') {
    annotations['web-export'] = true
    annotations.final = true
    annotations['raw-http'] = true
  } else if (action.web === false) {
    annotations['web-export'] = false
    annotations.final = false
    annotations['raw-http'] = false
  }
  // Get the former annotations of the action if any
  let former: openwhisk.Action
  if (!action.clean && !actionIsClean) {
    const options = { name, code: false }
    former = await wsk.actions.get(options).catch(() => undefined)
  }
  const oldAnnots = former && former.annotations ? makeDict(former.annotations) : {}
  // Merge the annotations
  const annotDict = Object.assign({}, oldAnnots, annotations)
  // Now process the webSecure annotation, which requires that the old annotations be available
  if (typeof action.webSecure === 'string' || action.webSecure === true) {
    annotDict['require-whisk-auth'] = action.webSecure
  } else if (action.webSecure === false) {
    delete annotDict['require-whisk-auth']
  }
  // Compute the complete Action value for the call
  const params = encodeParameters(action.parameters, action.environment)
  const exec = { code, binary: action.binary, kind: runtime, main: action.main } // Actually legal but openwhisk.Exec doesn't think so
  const actionBody: openwhisk.Action = { annotations: keyVal(annotDict), parameters: params, exec: exec as openwhisk.Exec }
  if (action.limits) {
    actionBody.limits = action.limits
  }
  const deployParams = { name, action: actionBody }
  return wsk.actions.update(deployParams).then(response => {
    const map = {}
    map[name] = { version: response.version, digest }
    const namespace = response.namespace.split('/')[0]
    return Promise.resolve(wrapSuccess(name, 'action', false, action.wrapping, map, namespace))
  }).catch(err => {
    return Promise.resolve(wrapError(err, `action '${name}'`))
  })
}
