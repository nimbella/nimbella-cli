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

import * as WorkbenchRun from './run'
import { NimBaseCommand, NimLogger, authPersister, getCredentials } from 'nimbella-deployer'

import { openWorkbench } from '../../workbench'

import { getCredentialsToken } from '../../oauth'

// Command to open the workbench from the CLI or switch between preview and production workbench for the purpose of transferring credentials
export default class WorkbenchLogin extends NimBaseCommand {
  static description = 'Open the Nimbella Workbench, logging in with current credentials'

  static flags: typeof WorkbenchRun.default.flags = WorkbenchRun.default.flags

  static args = []

  static aliases = ['wb:login']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    const creds = await getCredentials(authPersister).catch(err => logger.handleError('', err))
    const token = await getCredentialsToken(creds.ow, logger)
    const command = `auth login ${token} --apihost ${creds.ow.apihost}`
    openWorkbench(command, !!flags.preview, logger)
  }
}
