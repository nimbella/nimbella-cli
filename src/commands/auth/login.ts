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
import { doLogin, doAdminLogin, doInteractiveLogin, addCredentialAndSave, Credentials, authPersister, inBrowser } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, parseAPIHost } from '../../NimBaseCommand'
import { doOAuthFlow, isFullCredentials } from '../../oauth'
import { prompt } from '../../ui'

export default class AuthLogin extends NimBaseCommand {
  static description = 'Gain access to a Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host to use for authentication' }),
    auth: flags.string({ char: 'u', description: 'API key to use for authentication' }),
    admin: flags.boolean({ hidden: true }),
    namespace: flags.string({ hidden: true }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'token', description: 'String provided by Nimbella Corp', required: false }]

  static aliases = ['login']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    let credentials: Credentials
    const apihost = parseAPIHost(flags.apihost) // No default, so result may be undefined
    if (args.token) {
      if (flags.auth) {
        logger.handleError('You cannot specify both a login token and an auth key.  Use one or the other')
      }
      if (flags.admin || flags.namespace) {
        logger.handleError('Internal error: incorrect use of administrative flags')
      }
      // May throw if (1) apihost arg is undefined AND (2) there is no API host encoded in the token.
      // If both are present and are the same, the value is silently used.  If both are present and differ,
      // there will also be a thrown error but it will call out the fact of the difference.  IMO this is better
      // then either (1) silently ignoring the provided API host or (2) sending the token to it (it will be rejected
      // and that will be harder for the user to understand).
      credentials = await doLogin(args.token, authPersister, apihost).catch((err: Error) => this.handleError('', err))
    } else if (flags.admin) {
      if (flags.auth || flags.namespace || !apihost) {
        logger.handleError('Internal error: incorrect use of administrative flags')
      }
      credentials = await doAdminLogin(apihost).catch(err => this.handleError('', err))
    } else if (flags.auth) {
      // Low level login: set 'allowReplace' to false to guard against an overwrite that loses storage or redis.  An exception to this
      // is when the (hidden) namespace flag is provided.  This is to enable low level logins by nimadmin when doing a deploy.
      if (!apihost) {
        logger.handleError('The --apihost flag is required when using --auth')
      }
      credentials = await addCredentialAndSave(apihost, flags.auth, undefined, false, authPersister, flags.namespace, !!flags.namespace)
        .catch((err: Error) => logger.handleError('', err))
      authPersister.saveLegacyInfo(apihost, flags.auth)
    } else {
      // If apihost is undefined, doOAuthFlow will apply a default of https://apigcp.nimbella.io
      const response = await doOAuthFlow(logger, false, apihost).catch(err => logger.handleError('', err))
      if (isFullCredentials(response)) {
        credentials = await doInteractiveLogin(response, authPersister).catch(err => logger.handleError('', err))
      } else if (response === true) {
        // We have two different logics here, one for CLI and one for workbench.
        if (inBrowser) {
          // In the workbench, a true response is the norm.  We just need to reassure the user.
          await prompt('Login will restart the workbench with appropriate credentials (please wait)')
        } else {
          // In the CLI, a true response indicates a "long" provisioning (the wait for the redirect timed out).
          // It can also happen if the user just ignores the browser and does nothing.
          // We also reassure the user, but with some more instructions.
          logger.log('If you logged in, your account is being provisioned and should be ready in a minute or two.')
          logger.log("Try another 'nim auth login' then.")
        }
        return
      } else {
        logger.handleError(`Login failed.  Response was '${response}'`)
      }
    }
    logger.log(`Stored a credential set for namespace '${credentials.namespace}' on host '${credentials.ow.apihost}'`)
  }
}
