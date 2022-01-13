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

import { makeStorageClient, getCredentials, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { flags } from '@oclif/command'

export default class AuthInspect extends NimBaseCommand {
  static description = 'Get current namespace with optional details'

  static flags = {
    name: flags.boolean({ description: 'Show namespace name' }),
    apihost: flags.boolean({ description: 'Show API host' }),
    auth: flags.boolean({ description: 'Show API key' }),
    web: flags.boolean({ description: 'Show web domain (if available)' }),
    storage: flags.boolean({ description: 'Show storage status' }),
    redis: flags.boolean({ description: 'Show redis status' }),
    project: flags.boolean({ description: 'Show owning project' }),
    production: flags.boolean({ description: 'Show production status' }),
    all: flags.boolean({ description: 'Show all fields' }),
    ...NimBaseCommand.flags
  }

  static args = []

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    let { all, name, apihost, auth, web, storage, redis, project, production } = flags
    if (all) {
      name = apihost = auth = web = storage = redis = project = production = true
    } else if (!apihost && !auth && !web && !storage && !redis && !project && !production) {
      name = true
    }
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const ans: { name?: string, apihost?: string, auth?: string, web?: string, storage?: boolean, redis?: boolean, project?: string, production?: boolean } = {}
    if (name) {
      ans.name = creds.namespace
    }
    if (apihost) {
      ans.apihost = creds.ow.apihost
    }
    if (auth) {
      ans.auth = creds.ow.api_key
    }
    if (web) {
      if (creds.storageKey) {
        const storageClient = makeStorageClient(creds.namespace, creds.ow.apihost, true, creds.storageKey)
        ans.web = `${storageClient.getURL()}`
      } else {
        ans.web = 'Not available, upgrade your account.'
      }
    }
    if (storage) {
      ans.storage = !!creds.storageKey
    }
    if (redis) {
      ans.redis = creds.redis
    }
    if (project) {
      ans.project = creds.project
    }
    if (production) {
      ans.production = creds.production
    }
    if (Object.keys(ans).length === 1) {
      logger.log(String(Object.values(ans)[0]))
    } else {
      // The 'json' flag is not consulted because JSON output is assumed
      logger.logJSON(ans)
    }
  }
}
