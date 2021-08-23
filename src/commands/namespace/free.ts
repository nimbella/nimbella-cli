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
import { recordNamespaceOwnership, getCredentials, getCredentialDict, getCredentialList, authPersister, CredentialRow } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace } from '../../NimBaseCommand'
import { choicePrompter } from '../../ui'

// 'Free' a namespace entry in the credential store by removing any ownership information
export default class NamespaceFree extends NimBaseCommand {
    static description = 'Remove project ownership restrictions from namespaces'

    static flags = {
      apihost: flags.string({ description: 'API host serving the namespace(s)' }),
      all: flags.boolean({ description: 'free all namespaces (or, all on the given API host)' }),
      ...NimBaseCommand.flags
    }

    static args = [{ name: 'namespace', description: 'The namespace(s) you are freeing (current if omitted)', required: false }]
    static strict = false

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      if (flags.all && argv.length > 0) {
        logger.handleError('Cannot combine the \'--all\' flag with explicit namespace names')
      }
      const host = parseAPIHost(flags.apihost)
      if (host && argv.length === 0 && !flags.all) {
        logger.handleError('Cannot specify an API host without also specifying the namespace or the \'--all\' flag.')
      }

      // Process the --all case
      if (flags.all) {
        return this.freeAll(host, logger)
      }

      // Free just the current namespace (with prompt)
      if (argv.length === 0) {
        const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
        return await this.doFree(creds.namespace, creds.ow.apihost, logger)
      }

      // Free one or more namespaces by name
      for (const ns of argv) {
        const [namespace] = (await disambiguateNamespace(ns, host, choicePrompter).catch(err => logger.handleError('', err))).split(' on ')
        await this.doFree(namespace, host, logger)
      }
    }

    private async freeAll(host: string, logger: NimLogger) {
      let all: CredentialRow[]
      if (host) {
        const dict = await getCredentialDict(authPersister)
        all = dict[host]
      } else {
        all = await getCredentialList(authPersister)
      }
      for (const row of all) {
        await this.doFree(row.namespace, row.apihost, logger)
      }
    }

    private async doFree(namespace: string, host: string, logger: NimLogger) {
      const success = await recordNamespaceOwnership(undefined, namespace, host, undefined, authPersister)
      if (success) {
        logger.log(`Removed ownership from namespace '${namespace}'`)
      } else {
        logger.handleError(`Namespace '${namespace}' was not found`)
      }
    }
}
