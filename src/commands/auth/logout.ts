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
import { NimBaseCommand, NimLogger, NimFeedback, parseAPIHost, disambiguateNamespace, getCredentials, forgetNamespace, getCredentialList, authPersister, getApiHosts } from 'nimbella-deployer'

import { prompt, choicePrompter } from '../../ui'

export default class AuthLogout extends NimBaseCommand {
  static description = 'Drop access to Nimbella namespaces'

  static flags = {
    apihost: flags.string({ description: 'API host serving the namespace(s)' }),
    all: flags.boolean({ description: 'log out of all namespaces (or, all on the given API host)' }),
    force: flags.boolean({ char: 'f', description: 'Just do it, omitting confirmatory prompt' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'namespace', description: 'The namespace(s) you are dropping', required: false }]
  static strict = false

  static aliases = ['logout']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    if (flags.all && flags.apihost && argv.length > 0) {
      logger.handleError('Cannot combine \'--all\' and \'--apihost\' with explicit namespace names')
    }
    const host = parseAPIHost(flags.apihost)
    if (host && argv.length === 0 && !flags.all) {
      // what does it mean to logout from current namespace while specifying the api host? reject this.
      logger.handleError('Cannot specify an API host without also specifying the namespace or the \'--all\' flag.')
    }

    // Process the --all case without namespace names
    if (flags.all && argv.length === 0) {
      return this.logoutAll(host, logger, flags.force)
    }

    // Process logout from current namespace (with prompt)
    if (argv.length === 0) {
      const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))

      if (!flags.force) {
        const ans = await prompt(`Type 'yes' to logout '${creds.namespace}' namespace on API host '${creds.ow.apihost}'`)
        if (ans !== 'yes') {
          logger.log('Doing nothing.')
          return
        }
      }
      return await this.doLogout(creds.namespace, creds.ow.apihost, logger)
    }

    // Individual logout for one or more namespaces by name, possibly looping over apihosts if --all is specified
    for (const ns of argv) {
      if (flags.all) {
        const allHosts = await getApiHosts(authPersister)
        for (const onehost of allHosts) {
          const namespace = await disambiguateNamespace(ns, onehost, choicePrompter).catch(err => logger.handleError('', err))
          await this.doLogout(namespace, onehost, logger)
        }
      } else {
        const namespace = await disambiguateNamespace(ns, host, choicePrompter).catch(err => logger.handleError('', err))
        await this.doLogout(namespace, host, logger)
      }
    }
  }

  // Do logout of a namespace, with messages.  Note: the messages seem redundent but this is mostly to avoid breaking some existing tests.  We can
  // clean it up but then expect to have to fix the tests.
  async doLogout(namespace: string, host: string, logger: NimLogger): Promise<void> {
    const creds = await forgetNamespace(namespace, host, authPersister, new NimFeedback(logger)).catch(err => logger.handleError('', err))
    logger.log(`Ok.  Removed the namespace '${namespace}' on host '${creds.ow.apihost}' from the credential store`)
    logger.log(`Successful logout from namespace '${namespace}' on API host '${creds.ow.apihost}'`)
  }

  // Logout of 'all' namespaces (possibly qualified by API host)
  async logoutAll(host: string, logger: NimLogger, force: boolean): Promise<void> {
    // Issue prompt, being especially dire if API host is not specified
    const context = host ? `all namespaces on API host ${host}` : 'all namespaces, leaving you with no namespaces'
    if (!force) {
      const ans = await prompt(`Type 'yes' to logout ${context}`)
      if (ans !== 'yes') {
        logger.log('Doing nothing.')
        return
      }
    }
    let all = await getCredentialList(authPersister)
    if (host) {
      all = all.filter(row => row.apihost === host)
    }
    for (const row of all) {
      await this.doLogout(row.namespace, row.apihost, logger)
    }
  }
}
