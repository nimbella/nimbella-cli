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
import { NimBaseCommand, NimLogger } from 'nimbella-deployer'
import { authPersister } from 'nimbella-deployer'
import { queryKVStore } from '../../storage/key-value'

const queryCommand = 'redis/llen'

export default class LLen extends NimBaseCommand {
    static description = 'Returns the length of the list stored at key.\
 If a key does not exist, it is interpreted as an empty list and 0 is returned.\
 An error is returned when the value stored at key is not a list.'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'key', description: 'The key to be queried for length', required: true}];

    static aliases = ['kv:llen']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await queryKVStore(queryCommand, args, flags, authPersister)
          .then(res => logger.log(res.value))
          // Log the error returned by the action.
          .catch(err =>
            logger.handleError(
              err.error?.response?.result?.error || err.message
            )
          );
    }
}
