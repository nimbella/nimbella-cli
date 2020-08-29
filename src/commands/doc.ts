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

import { NimBaseCommand, NimLogger, inBrowser } from 'nimbella-deployer'

import { open } from '../ui'
const PUBLIC_DOC = 'https://nimbella.io/downloads/nim/nim.html'

export default class Doc extends NimBaseCommand {
  static description = 'Display the full documentation of this CLI'

  static flags: typeof NimBaseCommand.flags = { ...NimBaseCommand.flags }

  static args = []

  static aliases = ['docs']

  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    try {
      if (inBrowser) {
        logger.log('This displays the Nimbella CLI documentation')
        logger.log('Much of the Nimbella CLI command set also works in the workbench')
        logger.log('Type "menu" for some more orientation to the workbench')
        await open(PUBLIC_DOC)
      } else {
        const html = require.resolve('../../doc/nim.html')
        await open(html)
      }
    } catch (err) {
      logger.displayError('', err)
      logger.log('Packaging error: cannot locate documentation')
    }
  }
}
