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

// Adjunct to the project-reader when a project is defined as a set of github coordinates.
// Also contains the API for manipulating the github credentials of the credential store

import * as Path from 'path'
import * as fs from 'fs'
import * as Octokit from '@octokit/rest'
import * as rimrafOrig from 'rimraf'
import { promisify } from 'util'
import * as makeDebug from 'debug'
import { authPersister, getGithubAuth } from './credentials'

const rimraf = promisify(rimrafOrig)
const debug = makeDebug('nim:deployer:github')

const TEMP = process.platform === 'win32' ? process.env.TEMP : '/tmp'
const CACHE_DIR = 'deployer-git-cache'
function cacheDir() {
  return Path.join(TEMP, CACHE_DIR)
}

const prefixes = ['github:', 'https://github.com/', 'git@github.com:']

// GitHub coordinate definition structure
export interface GithubDef {
    owner: string
    repo: string
    path: string
    auth?: string
    baseUrl?: string
    ref?: string
}

// Assign a name to the otherwise anonymous branch of the Ocktokit.ReposGetContentResponse union type
export interface OctokitNonArrayResponse {
  // The actual type in Octokit has more fields but we don't bother since this is a workaround
  content: string
  encoding: BufferEncoding
}

// Test whether a project path is a github ref
export function isGithubRef(projectPath: string): boolean {
  for (const prefix of prefixes) {
    if (projectPath.startsWith(prefix)) {
      return true
    }
  }
  return false
}

// Parse a project path that claims to be a github ref into a GithubDef.  Throws on ill-formed
export function parseGithubRef(projectPath: string): GithubDef {
  // First isolate the 'ref' portion from the 'real project path'
  const hashSplit = projectPath.split('#')
  let ref: string
  if (hashSplit.length > 2) {
    throw new Error('too many # characters in GitHub reference')
  } else if (hashSplit.length === 2) {
    ref = hashSplit[1]
    projectPath = hashSplit[0]
  }
  // Strip the prefix.  Make sure this really is a github path (should be if we are called at all)
  let toParse: string
  for (const prefix of prefixes) {
    if (projectPath.startsWith(prefix)) {
      toParse = projectPath.replace(prefix, '')
      break
    }
  }
  if (!toParse) {
    throw new Error('internal error: parseGithubRef should not have been called')
  }
  // Because the prefix syntaxes ending in ':' can tolerate slashes or no slashes between the ':' and the owner field, elide
  // any initial slashes
  while (toParse.startsWith('/')) {
    toParse = toParse.slice(1)
  }
  // Now parse the unprefixed project path into owner/repo/[path]
  const slashSplit = toParse.split('/')
  if (slashSplit.length < 2) {
    throw new Error('too few / characters in GitHub reference; at least <owner>/<repo> is required')
  }
  const owner = slashSplit[0]
  let repo = slashSplit[1]
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, repo.length - 4)
  }
  const remainder = slashSplit.slice(2)
  let path: string
  // Determine whether the combination of the path and the already-examined ref fits the alternate form of
  // path /tree/<commitish>/<path>.  In that case, isolate the ref and path and proceed.
  if (remainder.length > 1 && remainder[0] === 'tree' && !ref) {
    ref = remainder[1]
    path = remainder.slice(2).join('/')
  } else {
    path = remainder.join('/')
  }
  // Add auth and optionally the baseUrl
  const rawAuth = getGithubAuth(authPersister)
  let [auth, baseUrl] = (rawAuth || '').split('@')
  if (baseUrl) {
    debug('original baseUrl: %s', baseUrl)
    if (!baseUrl.includes('api')) {
      baseUrl += '/api/v3'
    }
    if (!baseUrl.includes('://')) {
      baseUrl = 'https://' + baseUrl
    }
    debug('modified baseUrl: %s', baseUrl)
  }
  return { owner, repo, path, auth, baseUrl, ref }
}

// Fetch a project into the cache, returning a path to its location
export async function fetchProject(def: GithubDef, userAgent: string): Promise<string> {
  if (!fs.existsSync(cacheDir())) {
    fs.mkdirSync(cacheDir())
  }
  const cachedir = `${def.owner}_${def.repo}_${def.path.split('/').join('_')}`
  const location = Path.join(cacheDir(), cachedir)
  await rimraf(location)
  fs.mkdirSync(location)
  debug('fetching project %O', def)
  await fetchDir(makeClient(def, userAgent), def, def.path, location, true)
  return location
}

// Make a github client
export function makeClient(def: GithubDef, userAgent: string): Octokit {
  return new Octokit({ auth: def.auth, baseUrl: def.baseUrl, userAgent })
}

// Get contents from a github repo at specific coordinates (path and ref).  All but the path
// are taken from a GithubDef.  The path is specified as an argument.
export async function readContents(client: Octokit, def: GithubDef, path: string): Promise<Octokit.ReposGetContentsResponse> {
  debug('reading %O at %s', def, path)
  const { owner, repo, ref } = def
    type ResponseType = Octokit.Response<Octokit.ReposGetContentsResponse>
    let contents: ResponseType
    try {
      contents = await client.repos.getContents(ref ? { owner, repo, path, ref } : { owner, repo, path })
    } catch (err) {
      if (err.status === 404) {
        // Common user error
        throw new Error(`The repository path '${formatGithubDef(def)}' is not recognized by GitHub`)
      } else if (err.status === 403 && err.message.includes('rate limit exceeded')) {
        throw new Error(`You can't deploy '${formatGithubDef(def)}' without authenticating to GitHub (requires too high an access rate).`)
      } else {
        debug('Error detected in readContents: %O', err)
        throw err
      }
    }
    // Usually, Octokit throws on error cases ... this is just to catch exceptions to that rule
    if (contents.status !== 200) {
      throw new Error(`Reading path '${path}' from ${def.owner}/${def.repo}' failed with status code ${contents.status}`)
    }
    if (!contents.data) {
      throw new Error(`Reading path '${path}' from ${def.owner}/${def.repo}' succeeded but provided no data`)
    }
    return contents.data
}

// Test whether the 'data' array of a repo read response implies that the contents are a project
export function seemsToBeProject(data: Octokit.ReposGetContentsResponse): boolean {
  if (Array.isArray(data)) {
    const items = data as Octokit.ReposGetContentsResponseItem[]
    for (const item of items) {
      if (item.name === 'project.yml' && item.type === 'file') return true
      if (['packages', 'web'].includes(item.name) && item.type === 'dir') return true
    }
  }
  return false
}

function formatGithubDef(def: GithubDef): string {
  let ans = `${def.owner}/${def.repo}`
  if (def.path) {
    ans += '/' + def.path
  }
  if (def.ref) {
    ans += '#' + def.ref
  }
  return ans
}

// Fetch a directory into a cache location.
async function fetchDir(client: Octokit, def: GithubDef, path: string, location: string, validate: boolean) {
  const contents = await readContents(client, def, path)
  if (!Array.isArray(contents)) {
    debug('unexpected contents: %O', contents)
    throw new Error(`Path '${path} should be a directory but is not`)
  }
  if (validate && !seemsToBeProject(contents)) {
    throw new Error('GitHub location does not contain a \'nim\' project')
  }
  let promise: Promise<any> = Promise.resolve(undefined)
  for (const item of contents as Octokit.ReposGetContentsResponseItem[]) {
    const target = Path.join(location, item.name)
    if (item.type === 'dir') {
      fs.mkdirSync(target)
      promise = promise.then(() => fetchDir(client, def, item.path, target, false))
    } else {
      promise = promise.then(() => fetchFile(client, def, item.path, target))
    }
  }
  await promise
}

// Fetch a file into a cache location.   The 'def' argument is used to supply owner,
// repo and ref.   The auth member is already encoded in the client.  The path is taken from the path argument
async function fetchFile(client: Octokit, def: GithubDef, path: string, location: string) {
  const data = await readContents(client, def, path) as OctokitNonArrayResponse
  // Careful with the following: we want to support empty files but the empty string is falsey.
  if (typeof data.content !== 'string' || !data.encoding) {
    debug('unexpected contents: %O', data)
    throw new Error('Response from \'fetchFile\' was not interpretable')
  }
  const toWrite = Buffer.from(data.content, data.encoding)
  let mode = 0o666
  if (location.endsWith('.sh') || location.endsWith('.cmd')) {
    mode = 0o777
  }
  fs.writeFileSync(location, toWrite, { mode })
}
