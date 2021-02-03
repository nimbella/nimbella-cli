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
import {
  NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace, getCredentialsForNamespace, getCredentials, authPersister, wipeNamespace,
  cleanBucket, Credentials, makeStorageClient
} from 'nimbella-deployer'

import { prompt, choicePrompter } from '../../ui'

export default class NamespaceClean extends NimBaseCommand {
     static description = 'Remove content from a namespace'

     static flags = {
       justwhisk: flags.boolean({ description: 'Remove only OpenWhisk entities, leaving other content' }),
       force: flags.boolean({ description: 'Just do it, omitting confirmatory prompt' }),
       apihost: flags.string({ description: 'The API host of the namespace to be cleaned' }),
       auth: flags.string({ char: 'u', description: 'The API key for the namespace to be cleaned' }),
       ...NimBaseCommand.flags
     }

     static args = [{ name: 'namespace', description: 'The namespace to clean (current namespace if omitted)', required: false }]

     async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
       let namespace = args.namespace
       let creds: Credentials
       if (!namespace) {
         creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
         namespace = creds.namespace
       } else {
         namespace = await disambiguateNamespace(namespace, flags.apihost, choicePrompter)
       }
       if (!flags.force) {
         const ow = flags.justwhisk ? ' openwhisk' : ''
         const ans = await prompt(`Type 'yes' to remove all${ow} content from namespace '${namespace}'`)
         if (ans !== 'yes') {
           logger.log('Doing nothing.')
           return
         }
       }
       let auth: string
       let apihost: string
       let storageKey: Record<string, any>
       if (flags.auth && flags.apihost) {
         // Bypass credential fetching (used by `nimadmin` when cleaning up a namespace)
         auth = flags.auth
         apihost = parseAPIHost(flags.apihost)
         storageKey = undefined
       } else {
         if (!creds) {
           creds = await getCredentialsForNamespace(namespace, parseAPIHost(flags.apihost), authPersister)
             .catch(err => logger.handleError('', err))
         }
         auth = creds.ow.api_key
         apihost = creds.ow.apihost
         storageKey = creds.storageKey
       }
       await wipeNamespace(apihost, auth)
       logger.log(`OpenWhisk entities removed from namespace '${namespace}' on host '${apihost}'`)
       if (flags.justwhisk || !storageKey) {
         return
       }
       const client = makeStorageClient(namespace, apihost, true, storageKey)
       const msg = await cleanBucket(client, undefined, creds.ow)
       if (msg) {
         logger.log(msg)
       }
       logger.log(`Web content removed from ${client.getURL()}`)
     }
}
