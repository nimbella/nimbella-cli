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
import { NimBaseCommand, NimLogger, authPersister } from '@nimbella/nimbella-deployer'

import { queryKVStore } from '../../storage/key-value'

const queryCommand = 'redis/del'

export default class DeleteKey extends NimBaseCommand {
    static description = 'Removes the specified keys and returns number of keys that were removed. A key is ignored if it does not exist'
    static flags = {
      apihost: flags.string({ description: 'API host of the namespace' }),
      ...NimBaseCommand.flags
    }

    static args = [{ name: 'key', description: 'The key to be deleted', required: true }]

    static aliases = ['key-value:delete']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      await queryKVStore(queryCommand, args, flags, authPersister)
        .then(res => logger.log(res.value))
      // Log the error returned by the action.
        .catch(err =>
          logger.handleError(
              err.error?.response?.result?.error || err.message
          )
        )
    }
}
