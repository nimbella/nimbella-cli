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

import { NimBaseCommand, NimLogger } from 'nimbella-deployer'
import { inBrowser } from 'nimbella-deployer'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/invoke')

export default class ActionInvoke extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    // Ensure correct results in the workbench
    if (inBrowser) {
      this.debug('flags: %O', flags)
      // Impose oclif convention that boolean flags are really boolean, since action invoke logic depends on this.
      // Perhaps this should be done earlier since it represents a difference between kui and oclif.  Kui also
      // handles the '--no-' prefix differently: --no-wait will set --wait to false, not --no-wait to true.  On the
      // other hand, the abbreviation -n will indeed set --no-wait to true.
      flags.result == !!flags.result
      flags['no-wait'] = flags['no-wait'] || flags.wait === false
      // Also impose a different default (--full, rather than --result).
      flags.full = !flags.result && !flags['no-wait']
      this.debug('adjusted flags: %O', flags)
    }
    await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
  }

  static args = AioCommand.args

  // The template for parsing the flags is not changed for the browser because it is only used by oclif parsing
  // The browser inverts the flags by a special case in the usage model generator.
  static flags = AioCommand.flags

  static description = AioCommand.description
}
