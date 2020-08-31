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

import { WebResource, BucketSpec, DeployResponse } from './deploy-struct'
import { wrapSuccess, wrapError } from './util'
import * as fs from 'fs'
import * as path from 'path'

export function ensureWebLocal(webLocal: string): string {
  if (fs.existsSync(webLocal)) {
    if (fs.lstatSync(webLocal).isDirectory()) {
      return webLocal
    } else {
      throw new Error(`'${webLocal}' exists and is not a directory`)
    }
  }
  fs.mkdirSync(webLocal, { recursive: true })
  return webLocal
}

export function deployToWebLocal(resource: WebResource, webLocal: string, spec: BucketSpec): Promise<DeployResponse> {
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
  // Make relative to the webLocal directory
  destination = path.resolve(webLocal, destination)
  // Make sure that parent directories exist
  const parent = path.dirname(destination)
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true })
  }
  // Copy
  try {
    fs.copyFileSync(resource.filePath, destination)
    const response = wrapSuccess(destination, 'web', false, undefined, {}, undefined)
    return Promise.resolve(response)
  } catch (err) {
    return Promise.resolve(wrapError(err, `web resource '${resource.simpleName}'`))
  }
}
