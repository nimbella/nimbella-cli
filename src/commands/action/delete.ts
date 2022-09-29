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

import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getCredentials, authPersister, deleteAction } from '@nimbella/nimbella-deployer'
import openwhisk from 'openwhisk'

export default class ActionDelete extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    const arg = args.actionName
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const owClient = openwhisk(creds.ow)
    const deletedAction = await deleteAction(arg, owClient)
    if (Array.isArray(deletedAction)) {
      const errors = deletedAction as Error[]
      // We have tried using AggregateError here but ran into perplexing problems.  So, using an ad hoc approach
      // when combining errors.
      if (errors.length > 1) {
        const combined = Error('multiple errors occurred while deleting an action') as any
        combined.errors = errors
        throw combined
      }
      if (errors.length === 1) {
        throw errors[0]
      }
    }
    if (flags.json) {
      logger.logJSON(deletedAction)
    }
  }

  static args = [
    {
      name: 'actionName',
      required: true
    }
  ]

  static flags = {
    ...NimBaseCommand.flags // includes json flag
  }

  static description = 'deletes an action'
}
