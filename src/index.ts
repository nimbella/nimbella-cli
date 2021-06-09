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

import { CaptureLogger } from '@nimbella/nimbella-deployer'

// Run a nim command programmatically with output capture
export async function runNimCommand(command: string, args: string[]): Promise<CaptureLogger> {
  const cmd = require('./commands/' + command)
  if (!cmd || !cmd.default) {
    throw new Error(`'${command}' is not a 'nim' command`)
  }
  const logger = new CaptureLogger()
  await cmd.default.run(args, { root: __dirname, logger })
  return logger
}

export { CaptureLogger }
// Remaining exports are just for workbench incorporation and are not supported API
export { setKuiPrompter } from './ui'
export { setKuiOpen } from './ui'
