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

import { Includer } from './deploy-struct'
import * as makeDebug from 'debug'
const debug = makeDebug('nim:deployer:includer')

// Make an includer
export function makeIncluder(include: string, exclude: string): Includer {
  const includes = include ? include.split(',') : undefined
  const excludes = exclude ? exclude.split(',') : undefined
  const ans = new IncluderImpl(includes, excludes)
  debug('constructed includer: %O', ans)
  return ans
}

// The implementation behind the Includer interface
class IncluderImpl implements Includer {
    isWebIncluded = false
    isExcludingOnly = false
    includedPackages: Set<string> = new Set()
    excludedPackages: Set<string> = new Set()
    includedActions: Map<string, Set<string>> = new Map()
    excludedActions: Map<string, Set<string>> = new Map()

    // Construct
    constructor(includes: string[], excludes: string[]) {
      if (!includes) {
        this.isWebIncluded = true
        this.isExcludingOnly = true
      } else {
        for (let token of includes) {
          if (token === 'web') {
            this.isWebIncluded = true
            continue
          }
          if (token.endsWith('/')) {
            token = token.slice(0, -1)
          }
          const [pkg, action] = token.split('/')
          if (action) {
            this.addToMap(pkg, action, this.includedActions)
          } else {
            this.includedPackages.add(pkg)
          }
        }
      }
      if (excludes) {
        for (let token of excludes) {
          if (token === 'web') {
            this.isWebIncluded = false
            continue
          }
          if (token.endsWith('/')) {
            token = token.slice(0, -1)
          }
          const [pkg, action] = token.split('/')
          if (action) {
            this.addToMap(pkg, action, this.excludedActions)
          } else {
            this.excludedPackages.add(pkg)
          }
        }
      }
    }

    // Implement isPackageIncluded
    isPackageIncluded = (pkg: string, all: boolean) => {
      const nominallyIncluded = this.includedPackages.has(pkg) || (this.isExcludingOnly && !this.excludedPackages.has(pkg))
      if (all) {
        return nominallyIncluded && !this.excludedActions.has(pkg)
      } else {
        return nominallyIncluded || this.includedActions.has(pkg)
      }
    }

    // Implement isActionIncluded
    isActionIncluded = (pkg: string, action: string) => {
      if (this.isActionInMap(pkg, action, this.includedActions)) {
        return true // explicitly included
      }
      if (this.excludedPackages.has(pkg) || this.isActionInMap(pkg, action, this.excludedActions)) {
        return false // excluded, either explicitly or at package level
      }
      // So far, the action is not excluded but was not explicitly included either so the result depends on package inclusion
      return this.isExcludingOnly || this.includedPackages.has(pkg)
    }

    // Implement isIncludingEverything
    isIncludingEverything = () => {
      return this.isExcludingOnly && this.includedActions.size === 0 && this.includedPackages.size === 0
    }

    // Utility to add an action to an action map
    addToMap(pkg: string, action: string, map: Map<string, Set<string>>) {
      let set = map.get(pkg)
      if (!set) {
        set = new Set()
        map.set(pkg, set)
      }
      set.add(action)
    }

    // Utility to interrogate whether an action is in an action map
    isActionInMap(pkg: string, action: string, map: Map<string, Set<string>>): boolean {
      const set = map.get(pkg)
      if (!set) {
        return false
      }
      return set.has(action)
    }
}
