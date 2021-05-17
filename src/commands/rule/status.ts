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

import { NimBaseCommand, NimLogger } from '@nimbella/nimbella-deployer'
import RuntimeBaseCommand from '@adobe/aio-cli-plugin-runtime/src/RuntimeBaseCommand'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/rule/status')

export default class RuleStatus extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
    await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
  }

  static args = AioCommand.args

  static flags = AioCommand.flags

  static description = AioCommand.description
}
