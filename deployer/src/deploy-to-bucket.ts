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
  Credentials, WebResource, DeployResponse, DeploySuccess, BucketSpec, VersionEntry, ProjectReader, OWOptions
} from './deploy-struct'
import { getStorageProvider, StorageClient, StorageKey } from '@nimbella/storage'
import { wrapSuccess, wrapError, inBrowser } from './util'
import axios from 'axios'
import * as openwhisk from 'openwhisk'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:deploy-to-bucket')

// Open a "bucket client" (object of type Bucket) to use in deploying web resources or object resources
// to the bucket associated with the credentials.  Assumes credentials have sufficient information.
type BucketClientOptions = BucketSpec | 'data'
export async function openBucketClient(credentials: Credentials, options: BucketClientOptions): Promise<StorageClient> {
  const web = options !== 'data'
  const bucketSpec: BucketSpec = web ? options as BucketSpec : undefined
  debug('bucket client open')
  const bucket = makeStorageClient(credentials.namespace, credentials.ow.apihost, web, credentials.storageKey)
  if (bucketSpec) {
    await addWebMeta(bucket, bucketSpec)
  }
  return bucket
}

// Add web metadata after Bucket created but before returning it
function addWebMeta(bucket: StorageClient, bucketSpec: BucketSpec): Promise<StorageClient> {
  let mainPageSuffix = 'index.html'
  let notFoundPage = '404.html'
  if (bucketSpec) {
    if (bucketSpec.mainPageSuffix) {
      mainPageSuffix = bucketSpec.mainPageSuffix
    }
    if (bucketSpec.notFoundPage) {
      notFoundPage = bucketSpec.notFoundPage
    }
  }
  debug('Setting mainPageSuffix to %s and notFoundPage to %s', mainPageSuffix, notFoundPage)
  const website = { mainPageSuffix, notFoundPage }
  return bucket.setWebsite(website).then(() => bucket)
}

// Make a Bucket (client to access a bucket)
export function makeStorageClient(namespace: string, apiHost: string, web: boolean, credentials: StorageKey): StorageClient {
  debug('entered makeStorageClient')
  const provider = getStorageProvider(credentials.provider || '@nimbella/storage-gcs')
  debug('loaded impl: %O', provider)
  return provider.getClient(namespace, apiHost, web, credentials)
}

// Deploy a single resource to the bucket
export async function deployToBucket(resource: WebResource, client: StorageClient, spec: BucketSpec, versions: VersionEntry,
  reader: ProjectReader, owOptions: OWOptions): Promise<DeployResponse> {
  // Determine if something will be uploaded or if that will be avoided due to a digest match in incremental mode
  // The 'versions' argument is always defined in incremental mode.
  const data = await reader.readFileContents(resource.filePath)
  const hash = crypto.createHash('sha256')
  hash.update(data)
  const digest = String(hash.digest('hex'))
  if (versions && versions.webHashes && versions.webHashes[resource.filePath] && versions.webHashes[resource.filePath] === digest) {
    const webHashes = {}
    webHashes[resource.filePath] = versions.webHashes[resource.filePath]
    const success: DeploySuccess = { name: resource.filePath, kind: 'web', skipped: true }
    const response = { successes: [success], failures: [], ignored: [], actionVersions: {}, packageVersions: {}, webHashes, namespace: undefined }
    return Promise.resolve(response)
  } // else not incremental or no digest exists for this resource or digest does not match
  let destination = resource.simpleName
  // Do stripping
  if (spec && spec.strip) {
    let parts = destination.split(path.sep)
    if (parts.length > spec.strip) {
      parts = parts.slice(spec.strip)
      destination = parts.join(path.sep)
    }
  }
  // Do prefixing
  destination = (spec && spec.prefixPath) ? path.join(spec.prefixPath, destination) : destination
  debug('original destination: %s', destination)
  destination = destination.replace(/\\/g, '/') // windows conventions don't work on the bucket
  debug('fixed up destination: %s', destination)
  // Setup parameters for the upload
  const metadata: Record<string, any> = { contentType: resource.mimeType }
  if (!spec || !spec.useCache) {
    metadata.cacheControl = 'no-cache'
  }
  // Upload.
  debug('bucket save operation for %s with data of length %d and metadata %O', resource.simpleName, data.length, metadata)
  // Get signed URL for the upload (the more direct file.save() doesn't work in a browser, nor does calling file.getSignedUrl()
  // directly.  We use an assistive action to acquire the signed URL.
  const phaseTracker: string[] = []
  try {
    await doUpload(owOptions, client, destination, data, metadata, phaseTracker)
    debug('save operation for %s was successful', resource.simpleName)
  } catch (err) {
    debug('an error occurred: %O', err)
    return wrapError(err, `web resource '${resource.simpleName}' (${phaseTracker[0]})`)
  }
  const item = `${client.getURL()}/${destination}`
  const response = wrapSuccess(item, 'web', false, undefined, {}, undefined)
  response.webHashes = {}
  response.webHashes[resource.filePath] = digest
  debug('returning response %O', response)
  return response
}

// Subroutine to upload some data to a destination
async function doUpload(owOptions: OWOptions, client: StorageClient, destination: string, data: Buffer, metadata: any, phaseTracker: string[]) {
  if (inBrowser) {
    // Some google storage client functions misbehave in a browser.  In that environment, we use an action to obtain a signed URL
    // and PUT to the result.  The client call to upload directly will fail, as will the client code to obtain the signed URL directly.
    phaseTracker[0] = 'getting signed URL'
    const owClient = openwhisk(owOptions)
    const urlResponse = await owClient.actions.invoke({
      name: '/nimbella/websupport/getSignedUrl',
      params: { fileName: destination },
      blocking: true,
      result: true
    })
    phaseTracker[0] = 'putting data to signed URL'
    const url = urlResponse.url
    if (!url) {
      throw new Error(`Response from getSignedUrl was not a URL: ${urlResponse}`)
    }
    const putres = await axios.put(url, data)
    if (putres.status !== 200) {
      throw new Error('Bad response [$putres.status}] from storage server')
    }
    debug('signed URL put operation for %s was successful', destination)
    phaseTracker[0] = 'setting metadata'
    const remoteFile = client.file(destination)
    await remoteFile.setMetadata(metadata)
    debug('metadata saving operation for %s was successful', destination)
  } else {
    // In the CLI the straightforward google client functions work fine and are more efficient.  Also, we don't want to count
    // a bunch of extra action invokes against the user since we may have a rate limit on those.
    phaseTracker[0] = 'uploading file'
    const remoteFile = client.file(destination)
    await remoteFile.save(data, { metadata })
  }
}

// Clean the resources from a bucket starting at the root or at the prefixPath.
// Note: we use 'force' to make sure deletion is attempted for every file
// Note: we don't throw errors since cleaning the bucket is a "best effort" feature.
// Return (promise of) empty string on success, warning message if problems.
export async function cleanBucket(client: StorageClient, spec: BucketSpec, owOptions: OWOptions): Promise<string> {
  let prefix = spec ? spec.prefixPath : undefined
  if (prefix && !prefix.endsWith('/')) {
    prefix += '/'
  }
  debug('Cleaning up old web content')
  const options = prefix ? { force: true, prefix } : { force: true }
  await client.deleteFiles(options).catch(() => {
    return Promise.resolve('Note: one or more old web resources could not be deleted')
  })
  if (!prefix) {
    return restore404Page(client, owOptions)
  } else {
    return ''
  }
}

// Restore the 404.html page after wiping the bucket
export async function restore404Page(client: StorageClient, owOptions: OWOptions): Promise<string> {
  let our404: Buffer
  if (inBrowser) {
    our404 = require('../404.html').default
  } else {
    const file404 = require.resolve('../404.html')
    our404 = fs.readFileSync(file404)
  }
  const phaseTracker: string[] = []
  try {
    await doUpload(owOptions, client, '404.html', our404, { contentType: 'text/html' }, phaseTracker)
    return ''
  } catch (err) {
    debug(`while ${phaseTracker[0]}, got error ${err}`)
    return 'Standard 404.html page could not be restored'
  }
}
