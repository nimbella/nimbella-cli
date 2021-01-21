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

// The login subcommands

import { Credentials, FullCredentials } from './deploy-struct'
import { Persister, fileSystemPersister, addCredentialAndSave, addCredential } from './credentials'
import * as createDebug from 'debug'
import { wskRequest } from './util'
const debug = createDebug('nimbella.cli')

// Local types

// The expected response from the authorize action
// If status is success then apihost, uuid, and key, and will be present.
//   Storage will be present and non-empty iff the user has a bucket.
// If status is failed then only error will be present.
type Status = 'created' | 'success' | 'failed'
interface ExpectedResponse {
    status: Status
    apihost?: string
    error?: string
    uuid?: string
    key?: string
    storage?: string
    redis?: boolean
    namespace?: string
}

// Format of input piped to stdin from `nim user get`
interface NimUserData {
    namespace?: string
    uuid?: string
    key?: string
    storage?: string
    redis?: string
}

// Non-exported constants
const AUTHORIZE_URL_PATH = '/api/v1/web/nimbella/user/authorize.json'
const DEFAULT_API_HOST = 'https://apigcp.nimbella.io'

// Login with token.  Handles interaction with the Nimbella authorize action via the whisk REST API.
// Requires a function to store the results so that the same logic can be used by both the deployer and the workbench
// Optional third parameter provide the API host to use (defaults to the usual customer host)
export async function doLogin(token: string, persister: Persister, host: string = DEFAULT_API_HOST): Promise<Credentials> {
  const fullURL = host + AUTHORIZE_URL_PATH + '?token=' + token
  const rawResponse = await wskRequest(fullURL)
  if (rawResponse.statusCode >= 400) {
    throw new Error('The provided token is invalid')
  }
  const response: ExpectedResponse = rawResponse.body ? rawResponse.body : { error: 'unexpected response' }
  if (!response.status) {
    throw new Error('The response from the Nimbella service was ill-formed')
  } else if (response.status === 'failed') {
    throw new Error("The Nimbella Service responded '" + (response.error || 'unknown failure') + "'")
  } else {
    debug('authorize response: %O', response)
    const auth = response.uuid + ':' + response.key
    const apihost = response.apihost || host
    const credentials = await addCredentialAndSave(apihost, auth, response.storage, response.redis, persister, response.namespace, true)
    persister.saveLegacyInfo(apihost, auth)
    return credentials
  }
}

// Login using a JSON structure provided by `nim user set` (the same as the one returned by `nim user get`).
// This is designed to be run as a subprocess of `nim user set`, which feeds most of the information via
// stdin but passes the apihost on the command line.
export function doAdminLogin(apihost: string): Promise<Credentials> {
  return new Promise(function(resolve, reject) {
    process.stdin.setEncoding('utf8')
    let input = ''
    process.stdin.on('readable', () => {
      let chunk = process.stdin.read()
      while (chunk != null) {
        input += chunk
        chunk = process.stdin.read()
      }
    })
    process.stdin.on('end', async() => {
      const nimInput: NimUserData = JSON.parse(input)
      if (!nimInput.namespace || !nimInput.key || !nimInput.uuid) {
        reject(new Error(`Improper administrative login.  Expected valid user info but got '${input}'`))
      }
      const auth = nimInput.uuid + ':' + nimInput.key
      try {
        const creds = await addCredentialAndSave(apihost, auth, nimInput.storage, !!nimInput.redis, fileSystemPersister, nimInput.namespace, true)
        fileSystemPersister.saveLegacyInfo(apihost, auth)
        resolve(creds)
      } catch (err) {
        reject(err)
      }
    })
    process.stdin.on('error', reject)
  })
}

// Login using the result of a oauth flow (full interactive login using Auth0, either gmail or github)
// This function is called with the _result_ of the flow after testing for success.
export async function doInteractiveLogin(newCreds: FullCredentials, persister: Persister): Promise<Credentials> {
  const { apihost, namespace, uuid, key, redis, storage, externalId } = newCreds
  const auth = uuid + ':' + key
  const credStore = await persister.loadCredentialStore()
  const credentials = addCredential(credStore, apihost, namespace, auth, storage, redis)
  if (externalId && externalId.name && externalId.key) {
    if (!credStore.github) {
      credStore.github = {}
    }
    credStore.github[externalId.name] = externalId.key
    credStore.currentGithub = externalId.name
  }
  persister.saveCredentialStore(credStore)
  return credentials
}

// Utility functions (not exported)
