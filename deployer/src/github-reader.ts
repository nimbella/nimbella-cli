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

import { ProjectReader, PathKind } from './deploy-struct'
import { GithubDef, makeClient, readContents, seemsToBeProject, OctokitNonArrayResponse } from './github'
import * as Octokit from '@octokit/rest'
import * as PathPkg from 'path'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:github-reader')

// Defines the github version of the ProjectReader
// In general files passed to a ProjectReader are relative to the project path, which includes the path portion of
// the def.   To invoke github APIs, we need to make paths relative to the github repo root, so that means joining
// def.path with the argument and normalizing the result.  We don't want to use path.resolve because this isn't
// a real file system and the current working directory is irrelevant.  After normalizing, the result must fall
// within the repo

// The 'path' package should be forced to Posix behavior for this module.  In a browser, there is no posix member but you
// get posix behavior by default.  When not in a browser, though, 'posix' is needed for correct behavior on a windows system.
// Note that path.posix has known limitations: if you ask for a 'resolve' (or anything else that required the current
// directory, it will use the OS call even though you specified posix.   But, we don't ever do a resolve here because
// we are just doing path manipulation.
const Path = PathPkg.posix || PathPkg

// Make
export function makeGithubReader(def: GithubDef, userAgent: string): ProjectReader {
  const client = makeClient(def, userAgent)
  return new GithubProjectReader(client, def)
}

// The implementing class
class GithubProjectReader implements ProjectReader {
    client: Octokit
    def: GithubDef
    cache: Map<string, Octokit.ReposGetContentsResponse>

    constructor(client: Octokit, def: GithubDef) {
      debug('new github-reader for %O', def)
      this.client = client
      this.def = def
      this.cache = new Map()
    }

    // Implement getFSLocation for github (always returns null)
    getFSLocation(): string|null {
      return null
    }

    // Implement readdir for github
    async readdir(path: string): Promise<PathKind[]> {
      path = this.fixPathArgument(path)
      debug('reading directory %s', path)
      if (Path.isAbsolute(path)) {
        throw new Error('Deploying from GitHub does not support absolute paths')
      }
      const contents = await this.retrieve(path)
      if (!Array.isArray(contents)) {
        debug('improper contents: %O', contents)
        throw new Error(`Path '${path} should be a directory but is not`)
      }
      if (path === this.def.path && !seemsToBeProject(contents)) {
        throw new Error('GitHub location does not contain a \'nim\' project')
      }
      return contents.map(this.toPathKind)
    }

    // Subroutine used by readdir; may have other uses
    toPathKind(item: Octokit.ReposGetContentsResponseItem): PathKind {
      let mode = 0o666
      if (item.type === 'file' && (item.name.endsWith('.sh') || item.name.endsWith('.cmd'))) {
        mode = 0o777
      }
      return { name: item.name, isDirectory: item.type === 'dir', isFile: item.type === 'file', mode }
    }

    // Implement readFileContents for github
    async readFileContents(path: string): Promise<Buffer> {
      path = this.fixPathArgument(path)
      debug('reading file %s', path)
      const contents = await this.retrieve(path) as OctokitNonArrayResponse
      // Careful with the following: we want to support empty files but the empty string is falsey.
      if (typeof contents.content !== 'string' || !contents.encoding) {
        debug('improper contents: %O', contents)
        throw new Error(`Contents of file at '${path}' was not interpretable`)
      }
      return Buffer.from(contents.content, contents.encoding)
    }

    // Implement isExistingFile for github
    async isExistingFile(path: string): Promise<boolean> {
      debug('checking file existence: %s', path)
      const kind = await this.getPathKind(path)
      return kind && kind.isFile
    }

    // Implement getPathKind for github
    async getPathKind(path: string): Promise<PathKind> {
      path = this.fixPathArgument(path)
      debug('getting path type: %s', path)
      if (path === '' || path === '/' || path === undefined) {
        return { name: '', isFile: false, isDirectory: true, mode: 0x777 }
      }
      const name = Path.basename(path)
      const parent = Path.dirname(path)
      const candidates = await this.readdir(parent)
      for (const item of candidates) {
        if (item.name === name) {
          return item
        }
      }
      return Promise.resolve(undefined)
    }

    // Basic retrieval function with cache.  Cache is dead simple since we never modify anything
    async retrieve(path: string): Promise<Octokit.ReposGetContentsResponse> {
      const effectivePath = Path.normalize(Path.join(this.def.path, path))
      let contents = this.cache.get(effectivePath)
      if (!contents) {
        debug("going to github for '%s'", path)
        contents = await readContents(this.client, this.def, effectivePath)
        this.cache.set(effectivePath, contents)
      } else {
        debug("'%s' found in cache", path)
      }
      return contents
    }

    // Fixup function for path arguments.   On windows, the OS-specific path resolution is used
    // elsewhere in the deployer so path arguments may arrive in "windows" form.  They should not,
    // however be absolute, so a simple substitution of / for \ will suffice.
    fixPathArgument(path: string): string {
      if (!path) {
        return path
      }
      return path.split('\\').join('/')
    }
}
