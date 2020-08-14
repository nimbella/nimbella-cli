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

import { flags } from '@oclif/command'
import { NimBaseCommand, NimLogger, parseAPIHost } from 'nimbella-deployer'
import { doLogin, doAdminLogin, doInteractiveLogin, addCredentialAndSave, Credentials, authPersister, inBrowser } from 'nimbella-deployer'
import { doOAuthFlow, isFullCredentials } from '../../oauth'
import { prompt } from '../../ui'

export default class AuthLogin extends NimBaseCommand {
  static description = 'Gain access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host to use for authentication'}),
    auth: flags.string({ char: 'u', description: 'API key to use for authentication' }),
    admin: flags.boolean({ hidden: true }),
    namespace: flags.string({ hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = [{name: 'token', description: 'String provided by Nimbella Corp', required: false}]

  static aliases = ['login']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    let credentials: Credentials
    const apihost = parseAPIHost(flags.apihost) || (flags.admin ? undefined : 'https://apigcp.nimbella.io')
    if (args.token) {
      if (flags.auth) {
        logger.handleError('You cannot specify both a login token and an auth key.  Use one or the other')
      }
      if (flags.admin || flags.namespace) {
        logger.handleError("Internal error: incorrect use of administrative flags")
      }
      credentials = await doLogin(args.token, authPersister, apihost).catch((err: Error) => this.handleError('', err))
    } else if (flags.admin) {
      if (flags.auth || flags.namespace || !apihost) {
        logger.handleError("Internal error: incorrect use of administrative flags")
      }
      credentials = await doAdminLogin(apihost).catch(err => this.handleError('', err))
    } else if (flags.auth) {
      // Low level login: set 'allowReplace' to false to guard against an overwrite that loses storage or redis.  An exception to this
      // is when the (hidden) namespace flag is provided.  This is to enable low level logins by nimadmin when doing a deploy.
      credentials = await addCredentialAndSave(apihost, flags.auth, undefined, false, authPersister, flags.namespace, !!flags.namespace)
        .catch((err: Error) => logger.handleError('', err))
      authPersister.saveLegacyInfo(apihost, flags.auth)
    } else {
      const response = await doOAuthFlow(logger, false, flags.apihost).catch(err => logger.handleError('', err))
      if (isFullCredentials(response)) {
        credentials = await doInteractiveLogin(response, authPersister).catch(err => logger.handleError('', err))
      } else if (response === true) {
        // We have two different logics here, one for CLI and one for workbench.
        if (inBrowser) {
          // In the workbench, a true response is the norm.  We just need to reassure the user.
          await prompt(`Login will restart the workbench with appropriate credentials (please wait)`)
        } else {
          // In the CLI, a true response indicates a "long" provisioning (the wait for the redirect timed out).
          // It can also happen if the user just ignores the browser and does nothing.
          // We also reassure the user, but with some more instructions.
          logger.log("If you logged in, your account is being provisioned and should be ready in a minute or two.")
          logger.log("Try another 'nim auth login' then.")
        }
        return
      } else {
        logger.handleError(`Login failed.  Response was '${response}'`)
      }
    }
    logger.log(`Stored a credential set for namespace '${credentials.namespace}' on host '${apihost}'`)
  }
}
