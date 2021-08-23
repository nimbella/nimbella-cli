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

const queryCommand = 'redis/keys'

export default class KeysList extends NimBaseCommand {
    static description = 'Lists Keys from Key Value Store'

    static flags = {
      apihost: flags.string({ description: 'API host of the namespace to list keys from' }),
      json: flags.boolean({ char: 'j', description: 'Displays output in JSON form' }),
      namespace: flags.string({ description: 'The namespace to list keys from (current namespace if omitted)' }),
      ...NimBaseCommand.flags
    }

    static args = [{ name: 'prefix', description: 'Prefix to match keys against' }];

    static aliases = ['kv:list']

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger):Promise<void> {
      await queryKVStore(queryCommand, args, flags, authPersister)
        .then(res => {
          if (flags.json) {
            const outputJSON = { keys: [] }
            res.value.forEach((element: any) => {
              outputJSON.keys.push(element)
            })
            logger.logJSON(outputJSON)
          } else {
            res.value.forEach((element: string) => {
              logger.log(element)
            })
          }
        })
        .catch(err =>
          logger.handleError(
              err.error?.response?.result?.error || err.message
          )
        )
    }
}
