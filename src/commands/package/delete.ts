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

import { NimBaseCommand, NimLogger, authPersister } from '../../NimBaseCommand'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
import { flags } from '@oclif/command'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/package/delete')
import { getCredentials, wipePackage } from '../../deployer'

export default class PackageDelete extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // Don't delegate the recursive case.  We handle it specially here
    if (flags.recursive) {
      this.debug('invoking recursive delete')
      await this.recursiveDelete(args, flags, logger)
    } else {
      // Usual delegation
      this.debug('usual delegation to aio')
      await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
    }
  }

  static args = AioCommand.args

  static flags = {
    recursive: flags.boolean({ description: 'Delete the contained actions', char: 'r' }),
    // For some reason, aio's 'project delete' does not incorporate host and auth as is the usual practice with other commands
    apihost: flags.string({ description: 'Whisk API host' }),
    auth: flags.string({ char: 'u', description: 'Whisk auth' }),
   ...AioCommand.flags
  }

  static description = AioCommand.description

  // Recursive deletion
  async recursiveDelete(args: any, flags: any, logger: NimLogger) {
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const auth = flags.auth || (creds ? creds.ow.api_key : undefined)
    const apihost = flags.apihost || (creds ? creds.ow.apihost : undefined)
    if (!auth || !apihost) {
      logger.handleError(`You must either have current namespace or else provide --auth and --apihost`)
    }
    const result = await wipePackage(args.packageName, apihost, auth)
    if (flags.json) {
      AioCommand.logJSON('', result)
    }
  }
}
