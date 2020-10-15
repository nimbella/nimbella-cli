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
import { prompt } from '../../ui'

const queryCommand = 'redis/flush'
export default class Clean extends NimBaseCommand {
  static description = 'Clears the Key Value Store, be cautious!';

  static flags = {
    apihost: flags.string({ description: 'API host of the namespace' }),
    force: flags.boolean({ char: 'f', description: 'Just do it, omitting confirmatory prompt' }),
    ...NimBaseCommand.flags
  }

  static aliases = ['kv:clean'];

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {

    if (!flags.force) {
      const ans = await prompt(`Type 'yes' to remove all content from Key-Value Store`);
      if (ans !== 'yes') {
        logger.log('Doing nothing.');
        return;
      }
    }
    args.flush = true;
    await queryKVStore(queryCommand, args, flags, authPersister)
      .then(res => {
        if (res.value) {
          logger.log('all content cleared');
        } else {
          logger.handleError("couldn't clear content");
        }
      })
      // Log the error returned by the action.
      .catch(err =>
        logger.handleError(err.error?.response?.result?.error || err.message)
      );
  }
}
