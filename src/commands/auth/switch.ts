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
import { switchNamespace, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger, parseAPIHost, disambiguateNamespace, branding } from '../../NimBaseCommand'
import { choicePrompter } from '../../ui'

export default class AuthSwitch extends NimBaseCommand {
  static description = `Switch to a different ${branding.brand} namespace`

  static flags = {
    apihost: flags.string({ description: 'API host serving the target namespace' }),
    ...NimBaseCommand.flags
  }

  static args = [{ name: 'namespace', description: 'The namespace you are switching to', required: true }]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const host = parseAPIHost(flags.apihost)
    const [namespace, _host] = (await disambiguateNamespace(args.namespace, host, choicePrompter).catch(err => logger.handleError('', err))).split(' on ')
    const creds = await switchNamespace(namespace, _host, authPersister).catch(err => logger.handleError('', err))
    logger.logOutput({ status: 'Ok', namespace, apihost: creds.ow.apihost },
      [`Successful switch to namespace '${namespace}' on API host '${creds.ow.apihost}'`])
  }
}
