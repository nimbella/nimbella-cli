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
import * as Path from 'path'
import { promisify } from 'util'
import { ProjectReader, PathKind } from './deploy-struct'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:file-reader')

// Don't run promisify at module scope: will fail in browser.  This module will never actually be used in a browser.
let fs_readdir: (dir: fs.PathLike, options: { withFileTypes: boolean }) => Promise<fs.Dirent[]>
let fs_readfile: (file: fs.PathLike) => Promise<any>
let fs_lstat: (path: fs.PathLike) => Promise<any>
let fs_realpath: (path: fs.PathLike) => Promise<any>

// The file system implementation of ProjectReader
// The file system implementation accepts absolute paths and relative paths landing anywhere in the filesystem.
// At 'make' time, the path of the project (within the file system is provided)

// Make
export function makeFileReader(basepath: string): ProjectReader {
    debug("making file reader on basepath '%s'", basepath)
    fs_readdir = promisify(fs.readdir)
    fs_readfile = promisify(fs.readFile)
    fs_lstat = promisify(fs.lstat)
    fs_realpath = promisify(fs.realpath)
    return new FileProjectReader(basepath)
}

// Implementing class
class FileProjectReader implements ProjectReader {
    // Project location in the file system
    basepath: string

    constructor(basepath: string) {
        this.basepath = basepath
    }

    // Retrieve the basepath
    getFSLocation(): string {
        return this.basepath
    }

    // File system implementation of readdir.
    async readdir(path: string): Promise<PathKind[]> {
        debug("request to read directory '%s'", path)
        path = Path.resolve(this.basepath, path)
        path = await fs_realpath(path)
        debug("resolved to directory '%s", path)
        const entries = await fs_readdir(path, { withFileTypes: true })
        const results = entries.map(async entry => {
            let isFile: boolean, isDirectory: boolean
            if (entry.isSymbolicLink()) {
                const fullName = await fs_realpath(Path.resolve(path, entry.name))
                const stat = await fs_lstat(fullName)
                isFile = stat.isFile()
                isDirectory = stat.isDirectory()
            } else {
                isFile = entry.isFile()
                isDirectory = entry.isDirectory()
            }
            return { name: entry.name, isDirectory, isFile, mode: 0o666 }
        })
        return Promise.all(results)
    }

    // File system implementation of readFileContents
    async readFileContents(path: string): Promise<Buffer> {
        path = Path.resolve(this.basepath, path)
        path = await fs_realpath(path)
        return fs_readfile(path)
    }

    // File system implementation of isExistingFile
    isExistingFile(path: string): Promise<boolean> {
        debug("testing existence for file '%s'", path)
        path = Path.resolve(this.basepath, path)
        debug("resolved to file '%s", path)
        return fs_lstat(path).then((stats: fs.Stats) => {
            if (stats.isFile()) {
                debug("file exists")
                return true
            }
            debug("path exists but is not a file")
            return false
        }).catch(() => {
            debug("lstat failed for path %s", path)
            return false
        })
    }

    // File system implementation  of getPathKind
    getPathKind(path: string): Promise<PathKind> {
        path = Path.resolve(this.basepath, path)
        return fs_lstat(path).then((stats: fs.Stats) => {
            return { name: Path.basename(path), isFile: stats.isFile(), isDirectory: stats.isDirectory(), mode: stats.mode }
        }).catch(() => undefined)
    }
}
