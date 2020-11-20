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

import { NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace,
    doLogin, getCredentials, getCredentialsForNamespace, authPersister } from 'nimbella-deployer'
import { flags } from '@oclif/command'
import { getCredentialsToken } from '../../oauth'
import { choicePrompter } from '../../ui'

export default class AuthRefresh extends NimBaseCommand {
    static description = 'Refresh Nimbella namespace credentials by re-reading the latest from the backend'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'namespace', description: 'The namespace to refresh (omit for current namespace)', required: false } ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<any> {
    const host = parseAPIHost(flags.apihost)

    let namespace: string
    if (args.namespace) {
        namespace = await disambiguateNamespace(args.namespace, host, choicePrompter).catch(err => logger.handleError('', err))
    }

    if (host && !args.namespace) {
      logger.handleError(`The '--apihost' flag is only to be used when specifying a namespace explicitly`)
    }

    const creds = await (namespace ? getCredentialsForNamespace(namespace, host, authPersister) :
        getCredentials(authPersister)).catch(err => logger.handleError('', err))
    logger.log('Contacting the backend')
    const token = await getCredentialsToken(creds.ow, logger)
    logger.log('Refreshing credentials')
    await doLogin(token, authPersister, creds.ow.apihost)
    logger.log(`New credentials stored for namespace '${creds.namespace}'`)
  }
}
