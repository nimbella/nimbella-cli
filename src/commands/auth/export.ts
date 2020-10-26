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

import { NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace } from 'nimbella-deployer'
import { flags } from '@oclif/command'
import { getCredentials, getCredentialsForNamespace, authPersister } from 'nimbella-deployer'
import { getCredentialsToken } from '../../oauth'
import { choicePrompter } from '../../ui'

export default class AuthExport extends NimBaseCommand {
  static description = 'Make a token for switching to another machine or web browser'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace'}),
    'non-expiring': flags.boolean({ description: 'Generate non-expiring token (for functional ids and integrations)' }),
    json: flags.boolean({ description: 'Get response as a JSON object with a "token:" member' }),
    ...NimBaseCommand.flags
  }

  static args = [ { name: 'namespace', description: 'The namespace to export (omit for current namespace)', required: false } ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const host = parseAPIHost(flags.apihost)
    const nonExpiring = flags['non-expiring']

    let namespace: string
    if (args.namespace) {
        namespace = await disambiguateNamespace(args.namespace, host, choicePrompter).catch(err => logger.handleError('', err))
    }

    const creds = await (namespace ? getCredentialsForNamespace(namespace, host, authPersister) :
        getCredentials(authPersister)).catch(err => logger.handleError('', err))
    const token = await getCredentialsToken(creds.ow, logger, nonExpiring)
    if (flags.json) {
      logger.logJSON({ token })
    } else {
      logger.log(`The following token encodes credentials for namespace '${creds.namespace}' on host '${creds.ow.apihost}'`)
      if (nonExpiring) {
        logger.log('It may be used with `nim auth login` and does not expire.')
      } else {
        logger.log('It may be used with `nim auth login` within the next five minutes.')
      }
      logger.log(token)
    }
  }
}
