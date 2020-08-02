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
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { openWorkbench } from '../../workbench'

// Command to open the workbench from the CLI or switch between preview and production workbench for the purpose of running a command
export default class WorkbenchRun extends NimBaseCommand {
  static description = "Open the Nimbella Workbench and run a command there"

  static flags = { ...NimBaseCommand.flags,
    preview: flags.boolean({ description: 'Open preview workbench', char: 'p' })
  }

  static args = [{ name: 'command', description: 'An initial command to run', required: false }]
  static strict = false

  static aliases = [ 'wb:run' ]

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    let command: string
    if (argv.length == 0) {
      command = ''
    } else {
      command = argv.join(' ')
    }
    openWorkbench(command, !!flags.preview, logger)
  }
}
