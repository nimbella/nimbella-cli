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
import { authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { queryKVStore } from '../../storage/key-value'

const queryCommand = 'redis/rpush'

export default class RPush extends NimBaseCommand {
    static description = `Insert all the specified values at the tail of the list stored at key.
 It is created as an empty list before performing the push operation if the key does not exist.
 An error is returned when key holds such a value that is not a list`

    static flags = {
      apihost: flags.string({ description: 'API host of the namespace' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'key', description: 'The key to be added at', required: true },
      { name: 'value', description: 'The value to be added', required: true }
    ];

    static aliases = ['kv:rpush']

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
