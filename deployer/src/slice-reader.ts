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

import * as nim from '@nimbella/sdk'
import * as path from 'path'
import * as fs from 'fs'
import * as makeDebug from 'debug'
import * as Zip from 'adm-zip'
import * as rimraf from 'rimraf'
import { Credentials } from './deploy-struct'
import { Bucket } from '@google-cloud/storage'
import { getCredentials, authPersister } from './credentials'
const debug = makeDebug('nim:deployer:slice-reader')

const TEMP = process.platform === 'win32' ? process.env.TEMP : '/tmp'

// Provides a ProjectReader implementation suitable for reading project "slices" from the user's data bucket.
// This does not provide a ProjectReader specialization, just a `makeSliceReader` method that stages on disk
// and returns a FileProjectReader.  There is no value in avoiding the disk staging since it will be needed
// sooner or later to run the build (the main motivation for project slices being remote building).

// Make
export async function fetchSlice(sliceName: string): Promise<string> {
  await ensureObjectStoreCredentials()
  const cache = path.join(TEMP, 'slices', path.basename(sliceName))
  if (fs.existsSync(cache)) {
    rimraf.sync(cache)
  }
  debug('Making cache directory: %s', cache)
  fs.mkdirSync(cache, { recursive: true })
  const bucket: Bucket = await nim.storage()
  debug('have bucket client')
  const remoteFile = bucket.file(sliceName)
  debug('have remote file for %s', sliceName)
  const exists = await remoteFile.exists()
  debug('have exists response: %O', exists)
  if (!exists[0]) {
    debug('the slice does not exist')
    return ''
  }
  debug('have remote file %s ready to download', sliceName)
  const response = await remoteFile.download()
  debug('have download response: %O', response)
  if (!response || !response[0]) {
    debug('could not download slice')
    return ''
  }
  debug('have valid download response')
  const zip = new Zip(response[0])
  for (const entry of zip.getEntries().filter(entry => !entry.isDirectory)) {
    const target = path.join(cache, entry.entryName)
    const parent = path.dirname(target)
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true })
    }
    const mode = entry.attr >>> 16
    fs.writeFileSync(target, entry.getData(), { mode })
  }
  return cache
}

// This function is to support testing the slice-reader locally.  Normally, the slice-reader runs in an action
// that has object store credentials stored in the environment.  If it runs locally, those credentials will not
// (usually) be there.  So, suitable credentials are read from the credential store and placed in the environment
// to simulate the expected action runtime environment.
async function ensureObjectStoreCredentials() {
  const storeCreds = process.env.__NIM_STORAGE_KEY
  let creds: Credentials
  if (!storeCreds) {
    debug('Objectstore credentials were not available, attempting to load from credential store')
    creds = await getCredentials(authPersister) // will throw if no current namespace, that's ok
    const { credentials, project_id } = creds.storageKey
    const { client_email, private_key } = credentials
    process.env.__NIM_STORAGE_KEY = JSON.stringify({ client_email, private_key, project_id })
  }
  const namespace = process.env.__OW_NAMESPACE || process.env.savedOW_NAMESPACE
  const apiHost = process.env.__OW_API_HOST || process.env.savedOW_API_HOST
  if (!namespace || !apiHost) {
    debug('There was not enough information in the environment to determine the object store bucket name, attempting fix')
    if (!creds) {
      creds = await getCredentials(authPersister) // may throw, see above
    }
    process.env.__OW_NAMESPACE = creds.namespace
    process.env.__OW_API_HOST = creds.ow.apihost
  } else {
    // Reset into normal variables in case they were in the backup variables
    debug('Found namespace=%s and apiHost=%s', namespace, apiHost)
    process.env.__OW_NAMESPACE = namespace
    process.env.__OW_API_HOST = apiHost
  }
}
