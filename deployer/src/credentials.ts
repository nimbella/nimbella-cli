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

// Functions to manage the credential store.

import * as fs from 'fs'
import * as path from 'path'
import {
  CredentialStore, CredentialEntry, CredentialHostMap, Credentials, CredentialRow, Feedback
} from './deploy-struct'
import * as createDebug from 'debug'
import { wskRequest, inBrowser } from './util'
import { getStorageProvider, StorageKey } from '@nimbella/storage'
const debug = createDebug('nimbella.cli')

// Non-exported constants
const CREDENTIAL_STORE_KEY = 'wb.credential-store'
const HOME = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']
const NAMESPACE_URL_PATH = '/api/v1/namespaces'
const NIMBELLA_DIR = '.nimbella'
const WSK_PROPS = 'wskprops'
const CREDENTIAL_STORE = 'credentials.json'
// Function indirection needed for webpack
export function nimbellaDir(): string {
  const fromEnv = process.env.NIMBELLA_DIR
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  return path.join(HOME, NIMBELLA_DIR)
}
function wskProps() {
  return path.join(nimbellaDir(), WSK_PROPS)
}
function credentialStore() {
  return path.join(nimbellaDir(), CREDENTIAL_STORE)
}

// Exports

// The type of a persistance manager, which will differ between cloud and local
export interface Persister {
    loadCredentialStoreIfPresent: () => CredentialStore
    loadCredentialStore: () => Promise<CredentialStore>
    saveCredentialStore: (store: CredentialStore) => void
    saveLegacyInfo: (apihost: string, auth: string) => void
}

// The persister to use when local storage is accessible (deployer CLI or non-cloud workbench)
export const fileSystemPersister: Persister = { loadCredentialStoreIfPresent, loadCredentialStore, saveCredentialStore, saveLegacyInfo }
// The persister to use when running in a browser (cloud workbench). Kept here for dependency management
// convenience inside the workbench
export const browserPersister: Persister = {
  loadCredentialStoreIfPresent: browserLoadCredentialStoreIfPresent,
  loadCredentialStore: browserLoadCredentialStore,
  saveCredentialStore: browserSaveCredentialStore,
  saveLegacyInfo: browserSaveLegacyInfo
}
// The persister to use for all auth code if you might run in either CLI or browser
// Not a constant so that it can be explicitly set in the workbench
export let authPersister = inBrowser ? browserPersister : fileSystemPersister
// For explicitly setting in workbench
export function setInBrowser(): void {
  authPersister = browserPersister
}

// Add credential to credential store and make it the default.  Does not persist the result
export function addCredential(store: CredentialStore, apihost: string, namespace: string, api_key: string, storage: string,
  redis: boolean): Credentials {
  debug('Adding credential to credential store')
  let nsMap = store.credentials[apihost]
  if (!nsMap) {
    nsMap = {}
    store.credentials[apihost] = nsMap
  }
  const storageKey = storage ? parseStorageString(storage, namespace) : undefined
  nsMap[namespace] = { api_key, storageKey, redis }
  store.currentHost = apihost
  store.currentNamespace = namespace
  return { namespace, ow: { apihost, api_key }, storageKey, redis }
}

// Remove a namespace from the credential store
export async function forgetNamespace(namespace: string, apihost: string|undefined, persister: Persister, feedback: Feedback): Promise<Credentials> {
  const store = await persister.loadCredentialStore()
  const creds = getUniqueCredentials(namespace, apihost, store)
  const host = apihost || creds.ow.apihost
  const hostMap = store.credentials[host]
  let undefinedWarning = false
  if (hostMap && hostMap[namespace]) {
    delete hostMap[namespace]
    if (host === store.currentHost && store.currentNamespace === namespace) {
      store.currentNamespace = undefined
      undefinedWarning = true
      try {
        fs.unlinkSync(wskProps())
      } catch {
        // Do nothing
      }
    }
    persister.saveCredentialStore(store)
    if (undefinedWarning) {
      feedback.warn(`'${namespace}' was the current namespace`)
      feedback.warn('A new namespace target must be specified on or before the next project deployment')
    }
  } else {
    feedback.warn(`There is no credential entry for namespace '${namespace}' on API host '${host}'`)
  }
  return creds
}

// Switch the active namespace in the credential store.  The namespace argument is required.
// All occurrences of the namespace across all API hosts are collected.
// If there is an explicit 'apihost' argument this collection must include an entry with that API host
// Otherwise,
//   - if there is just one occurrence, the switch is to that namespace on that API host
//   - otherwise, no switch occurs and the thrown Error either states that no credentials exist for that namespace
//     or that the --apihost flag is required to indicate which one is intended
export async function switchNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
  const store = await persister.loadCredentialStore()
  const answer = getUniqueCredentials(namespace, apihost, store)
  const newHost = answer.ow.apihost
  if (store.currentHost === newHost && store.currentNamespace === namespace) {
    debug('not an actual change')
    return answer
  }
  store.currentHost = newHost
  store.currentNamespace = namespace
  persister.saveCredentialStore(store)
  persister.saveLegacyInfo(newHost, answer.ow.api_key)
  debug(`Switched target namespace to '${namespace}' on API host '${newHost}'`)
  return answer
}

// Get a valid Credentials object by finding the information in the environment.   This will generally not work in the
// CLI context but is designed to work via the deployer API when running in actions.  It may be especially
// useful in shared packages, where the credentials in the environment will vary by invoking user.
// For the information to be fully usable the environment must include __OW_API_KEY, which is only present when
// the action is annotated with provide-api-key=true.
// If the environment is inadequate to support this API, an error is generally not indicated.  Instead,
// an incomplete Credentials object is returned.
export function getCredentialsFromEnvironment(): Credentials {
  const storeCreds = process.env.__NIM_STORAGE_KEY
  const apihost = process.env.__OW_API_HOST
  const namespace = process.env.__OW_NAMESPACE
  const api_key = process.env.__OW_API_KEY
  const redis = !!process.env.__NIM_REDIS_PASSWORD
  let storageKey
  if (storeCreds) {
    try {
      storageKey = parseStorageString(storeCreds, namespace)
    } catch (_) {
      // Assume no storage if can't be parsed
    }
  }
  return { namespace, ow: { api_key, apihost }, redis, storageKey }
}

// Get the credentials for a namespace.  Similar logic to switchNamespace but does not change which
// namespace is considered current.
export async function getCredentialsForNamespace(namespace: string, apihost: string|undefined, persister: Persister): Promise<Credentials> {
  const store = await persister.loadCredentialStore()
  return getUniqueCredentials(namespace, apihost, store)
}

// Get the current credentials.  This will succeed iff the user has a credential store and a current namespace.
// Otherwise, we throw an error.
export async function getCredentials(persister: Persister): Promise<Credentials> {
  const store = await persister.loadCredentialStore()
  if (!store.currentHost || !store.currentNamespace) {
    throw new Error("You do not have a current namespace.  Use 'nim auth login' to create a new one or 'nim auth switch' to use an existing one")
  }
  const entry = store.credentials[store.currentHost][store.currentNamespace]
  const { storageKey, api_key, redis, project, production, commander } = entry
  return { namespace: store.currentNamespace, ow: { apihost: store.currentHost, api_key }, storageKey, redis, project, production, commander }
}

// Convenience function to load, add, save a new credential.  Includes check for whether an entry would be replaced.
export async function addCredentialAndSave(apihost: string, auth: string, storage: string, redis: boolean,
  persister: Persister, namespace: string, allowReplacement: boolean): Promise<Credentials> {
  const credStore = await persister.loadCredentialStore()
  const nsPromise = namespace ? Promise.resolve(namespace) : getNamespace(apihost, auth)
  return nsPromise.then(namespace => {
    if (!allowReplacement && wouldReplace(credStore, apihost, namespace, auth)) {
      throw new Error(`Existing credentials for namespace '${namespace}' cannot be replaced using '--auth'.  To replace it, logout first, or login without '--auth'`)
    }
    const credentials = addCredential(credStore, apihost, namespace, auth, storage, redis)
    persister.saveCredentialStore(credStore)
    return credentials
  })
}

// Record namespace ownership in the credential store
export async function recordNamespaceOwnership(project: string, namespace: string, apihost: string, production: boolean,
  persister: Persister): Promise<boolean> {
  const store = await persister.loadCredentialStore()
  if (!apihost) {
    const fullCreds = getUniqueCredentials(namespace, undefined, store)
    apihost = fullCreds.ow.apihost
  }
  const hostEntry = store.credentials[apihost]
  if (hostEntry && hostEntry[namespace]) {
    hostEntry[namespace].project = project
    hostEntry[namespace].production = production
  } else {
    return false
  }
  persister.saveCredentialStore(store)
  return true
}

// Provide contents of the CredentialStore in a dictionary style suitable for listing and tabular presentation
export async function getCredentialDict(persister: Persister): Promise<{[host: string]: CredentialRow[]}> {
  const store = await persister.loadCredentialStore()
  const result: {[host: string]: CredentialRow[]} = {}
  for (const apihost in store.credentials) {
    let rows: CredentialRow[] = []
    for (const namespace in store.credentials[apihost]) {
      const current = apihost === store.currentHost && namespace === store.currentNamespace
      const storage = !!store.credentials[apihost][namespace].storageKey
      const { redis, project, production } = store.credentials[apihost][namespace]
      rows.push({ namespace, current, storage, apihost, redis, project, production })
      rows = rows.sort((a, b) => a.namespace.localeCompare(b.namespace))
    }
    result[apihost] = rows
  }
  return result
}

// Get the list of apihosts from the credential store
export async function getApiHosts(persister: Persister): Promise<string[]> {
  const store = await persister.loadCredentialStore()
  return Object.keys(store.credentials)
}

// Flat (single array) version of getCredentialDict
export async function getCredentialList(persister: Persister): Promise<CredentialRow[]> {
  const dict = await getCredentialDict(persister)
  return Object.values(dict).reduce((acc, val) => acc.concat(val), [])
}

// Get the namespace associated with an auth on a specific host
export function getNamespace(host: string, auth: string): Promise<string> {
  debug('getting current namespace')
  const url = host + NAMESPACE_URL_PATH
  return wskRequest(url, auth).then(list => list[0])
}

// Get current namespace
export async function getCurrentNamespace(persister: Persister): Promise<string|undefined> {
  debug('getting current namespace')
  const store = await persister.loadCredentialStore()
  return store.currentNamespace
}

// fileSystemPersister functions (indirectly exported)
function saveCredentialStore(store: CredentialStore): void {
  const toWrite = JSON.stringify(store, null, 2)
  debug('writing credential store')
  fs.writeFileSync(credentialStore(), toWrite)
}

function saveLegacyInfo(apihost: string, auth: string): void {
  saveWskProps(apihost, auth)
  debug('stored .wskprops with API host %s', apihost)
}

function loadCredentialStore(): Promise<CredentialStore> {
  // Returns a promise for historical reasons.  Could be tweaked since
  // the promise is no longer needed.
  if (!fs.existsSync(credentialStore())) {
    return Promise.resolve(initialCredentialStore())
  }
  const contents = fs.readFileSync(credentialStore())
  return Promise.resolve(JSON.parse(String(contents)))
}

function loadCredentialStoreIfPresent(): CredentialStore {
  if (!fs.existsSync(credentialStore())) {
    return undefined
  }
  const contents = fs.readFileSync(credentialStore())
  return JSON.parse(String(contents))
}

// browserPersister functions (indirectly exported)

function browserLoadCredentialStoreIfPresent(): CredentialStore {
  const store = window.localStorage.getItem(CREDENTIAL_STORE_KEY)
  if (!store || store === '') {
    const currentHost = window.location.origin
    const currentNamespace = undefined
    const credentials: CredentialHostMap = {}
    credentials[currentHost] = {}
    return { currentHost, currentNamespace, credentials }
  } else {
    return JSON.parse(store)
  }
}

function browserLoadCredentialStore(): Promise<CredentialStore> {
  return Promise.resolve(browserLoadCredentialStoreIfPresent())
}

function browserSaveCredentialStore(store: CredentialStore): void {
  const storeString = JSON.stringify(store)
  window.localStorage.setItem(CREDENTIAL_STORE_KEY, storeString)
}

function browserSaveLegacyInfo(_apihost: string, _auth: string): void {
  // No-op
}

// Utility functions (not exported)

// Make the initial credential store when none exists.  It always starts out empty.  This also makes
// the parent directory preparatory to the first write.  It does not actually write the credential store.
function initialCredentialStore(): CredentialStore {
  if (!fs.existsSync(nimbellaDir())) {
    fs.mkdirSync(nimbellaDir())
  }
  return { currentHost: undefined, currentNamespace: undefined, credentials: {} }
}

// Determine if a new namespace/auth pair would replace an entry with the same pair that has storage or redis.
// This is allowed for "high level" logins where the information is presumably coming via a token or oauth flow or via
// `nimadmin user set`.   This checking function is not called in those cases.
// However, "low level" logins by customers are given an informational message and the entry is not replaced.
// This is to guard against surprising lossage of storage or redis information since a low level login with
// --auth does not have that information.   A customer can still replace the entry for a namespace if he
// provides a _different_ auth.  There's still a possibility of error, then, but the "error" would be
// explainable and not surprising.  We allow this case because our own test projects routinely change the
// key of 'nimbella' which is first set with a low-level login.
function wouldReplace(store: CredentialStore, apihost: string, namespace: string, auth: string): boolean {
  const existing = store.credentials[apihost] ? store.credentials[apihost][namespace] : undefined
  if (!existing || (!existing.storageKey && !existing.redis)) {
    return false
  }
  return auth === existing.api_key
}

// Write ~/.nimbella/wskprops.  Used when the default api host or api key change (TODO: this never saves the 'insecure' flag; that should
// probably be correlated with the api host)
function saveWskProps(apihost: string, auth: string) {
  const wskPropsContents = `APIHOST=${apihost}\nAUTH=${auth}\n`
  fs.writeFileSync(wskProps(), wskPropsContents)
}

// Given a namespace and _optionally_ an apihost, return the credentials, throwing errors based on the
// number of matches.  Used in cases where the credentials are expected to exist but the client may or
// may not have provided an API host
function getUniqueCredentials(namespace: string, apihost: string|undefined, store: CredentialStore): Credentials {
  const possibles: {[key: string]: CredentialEntry} = {}
  let credentialEntry: CredentialEntry
  let newHost: string
  for (const host in store.credentials) {
    const entry = store.credentials[host][namespace]
    if (entry) {
      possibles[host] = entry
    }
  }
  if (apihost) {
    if (possibles[apihost]) {
      credentialEntry = possibles[apihost]
      newHost = apihost
    } else {
      throw new Error(`No credentials found for namespace '${namespace}' on API host '${apihost}'`)
    }
  } else {
    const pairs = Object.entries(possibles)
    if (pairs.length === 1) {
      [newHost, credentialEntry] = pairs[0]
    } else if (pairs.length === 0) {
      throw new Error(`No credentials found for namespace '${namespace}' on any API host`)
    } else {
      throw new Error(`The namespace '${namespace}' exists on more than one API host.  An '--apihost' argument is required`)
    }
  }
  const { storageKey, api_key, redis, project, production, commander } = credentialEntry
  debug('have authkey: %s', api_key)
  return { namespace, ow: { apihost: newHost, api_key }, storageKey, redis, project, production, commander }
}

// Turn a raw storage string into the form used internally.
function parseStorageString(storage: string, namespace: string): StorageKey {
  if (storage === 'yes') {
    throw new Error(`Storage was not fully initialized for namespace '${namespace}'`)
  }
  let parsedStorage
  try {
    parsedStorage = JSON.parse(storage)
  } catch {
    throw new Error(`Corrupt storage string for namespace '${namespace}'`)
  }
  const provider = getStorageProvider(parsedStorage.provider || '@nimbella/storage-gcs')
  return provider.prepareCredentials(parsedStorage)
}

// Commander section

// Add the commander data section to a namespace entry.  Returns Promise<true> on success and Promise<false> if the namespace
// entry does not exist.
export async function addCommanderData(apihost: string, namespace: string, data: Record<string, unknown>, persister: Persister): Promise<boolean> {
  const store = await persister.loadCredentialStore()
  const hostEntry = store.credentials[apihost]
  if (hostEntry && hostEntry[namespace]) {
    hostEntry[namespace].commander = data
  } else {
    return false
  }
  persister.saveCredentialStore(store)
  return true
}

// GitHub credentials section

// Retrieve a list of locally known github accounts
export async function getGithubAccounts(persister: Persister): Promise<{[key: string]: string}> {
  const store = await persister.loadCredentialStore()
  debug('GitHub accounts requested, returning %O', store.github)
  return store.github || {}
}

// Delete a github account
type DeleteResult = 'DeletedOk' | 'DeletedDangling' | 'NotExists'
export async function deleteGithubAccount(name: string, persister: Persister): Promise<DeleteResult> {
  const store = await persister.loadCredentialStore()
  if (store.github && store.github[name]) {
    delete store.github[name]
    if (name === store.currentGithub) {
      store.currentGithub = undefined
    }
    debug('GitHub deletion of account %s succeeded, with currentGithub=%s', name, store.currentGithub)
    persister.saveCredentialStore(store)
    return store.currentGithub ? 'DeletedOk' : 'DeletedDangling'
  } else {
    return 'NotExists'
  }
}

// Get active github token
export function getGithubAuth(persister: Persister): string {
  const store = persister.loadCredentialStoreIfPresent()
  if (store && store.github && store.currentGithub) {
    return store.github[store.currentGithub]
  }
  return undefined
}

// Switch the active github account
export async function switchGithubAccount(name: string, persister: Persister): Promise<boolean> {
  const store = await persister.loadCredentialStore()
  if (store.github && store.github[name]) {
    store.currentGithub = name
    persister.saveCredentialStore(store)
    return true
  } else {
    return false
  }
}

// Add a github account
export async function addGithubAccount(name: string, token: string, persister: Persister): Promise<void> {
  const store = await persister.loadCredentialStore()
  if (!store.github) {
    store.github = {}
  }
  debug('adding github account with name %s and token %s', name, token)
  store.github[name] = token
  store.currentGithub = name
  persister.saveCredentialStore(store)
}

// Postman credentials section

// Retrieve a list of locally known postman keys
export async function getPostmanKeys(persister: Persister): Promise<{[key: string]: string}> {
  const store = await persister.loadCredentialStore()
  debug('Postman keys requested, returning %O', store.postman)
  return store.postman || {}
}

// Retrieve current key
export async function getPostmanCurrentKey(persister: Persister): Promise<string|undefined> {
  const store = await persister.loadCredentialStore()
  debug('Postman current key requested, returning %O', store.currentPostman)
  return store.currentPostman
}

// Delete a postman key
export async function deletePostmanKey(name: string, persister: Persister): Promise<DeleteResult> {
  const store = await persister.loadCredentialStore()
  if (store.postman && store.postman[name]) {
    delete store.postman[name]
    if (name === store.currentPostman) {
      store.currentPostman = undefined
    }
    debug('Postman deletion of key %s succeeded, with currentPostman=%s', name, store.currentPostman)
    persister.saveCredentialStore(store)
    return store.currentPostman ? 'DeletedOk' : 'DeletedDangling'
  } else {
    return 'NotExists'
  }
}

// Switch the active postman key
export async function switchPostmanKey(name: string, persister: Persister): Promise<boolean> {
  const store = await persister.loadCredentialStore()
  if (store.postman && store.postman[name]) {
    store.currentPostman = name
    persister.saveCredentialStore(store)
    return true
  } else {
    return false
  }
}

// Add a postman key
export async function addPostmanKey(name: string, token: string, persister: Persister): Promise<void> {
  const store = await persister.loadCredentialStore()
  if (!store.postman) {
    store.postman = {}
  }
  debug('adding postman key with name %s and token %s', name, token)
  store.postman[name] = token
  store.currentPostman = name
  persister.saveCredentialStore(store)
}
