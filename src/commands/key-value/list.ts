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

const queryCommand = 'redis/keys'

export default class KeysList extends NimBaseCommand {
    static description = 'Lists Keys from Key Value Store'

    static flags = {
        apihost: flags.string({ description: 'API host of the namespace to list keys from' }),
        namespace: flags.string({ description: 'The namespace to list keys from (current namespace if omitted)' }),
        ...NimBaseCommand.flags
    }

    static args = [{ name: 'prefix', description: 'Prefix to match keys against'}];

    static aliases = ['kv:list']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
        await queryKVStore(queryCommand, args, flags, authPersister)
          .then(res => {
            res.value.forEach(element => {
              logger.log(element);
            });
          })
          // Log the error returned by the action.
          .catch(err =>
            logger.handleError(
              err.error?.response?.result?.error || err.message
            )
          );
    }
}
