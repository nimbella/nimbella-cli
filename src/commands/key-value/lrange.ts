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

const queryCommand = 'redis/lrange'

export default class LRange extends NimBaseCommand {
    static description = `Returns the specified elements of the list stored at key.
 The offsets start and stop are zero-based indexes, with 0 being the first element of the list,
 1 being the next element and so on.`

    static flags = {
      apihost: flags.string({ description: 'API host of the namespace to list keys from' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'key', description: 'The key to be queried', required: true },
      { name: 'start', description: 'The index to start', required: true },
      { name: 'stop', description: 'The index to stop', required: true }
    ];

    static aliases = ['kv:lrange']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      await queryKVStore(queryCommand, args, flags, authPersister)
        .then(res => {
          res.value.forEach(element => {
            logger.log(element)
          })
        })
      // Log the error returned by the action.
        .catch(err =>
          logger.handleError(
              err.error?.response?.result?.error || err.message
          )
        )
    }
}
