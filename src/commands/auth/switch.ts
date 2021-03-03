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
import { NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace, switchNamespace, authPersister } from 'nimbella-deployer'

import { choicePrompter } from '../../ui'

export default class AuthSwitch extends NimBaseCommand {
  static description = 'Switch to a different Nimbella namespace'

  static flags = {
    apihost: flags.string({ description: 'API host serving the target namespace' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'namespace', description: 'The namespace you are switching to', required: true }]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const host = parseAPIHost(flags.apihost)
    const namespace = await disambiguateNamespace(args.namespace, host, choicePrompter).catch(err => logger.handleError('', err))
    // console.log('namespace', namespace);
    // console.log('host', host);
    const [ns, h] = namespace.split(' on ')
    const creds = await switchNamespace(ns, h, authPersister).catch(err => logger.handleError('', err))
    logger.log(`Successful switch to namespace '${ns}' on API host '${creds.ow.apihost}'`)
  }
}
