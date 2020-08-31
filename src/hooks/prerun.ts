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

import { Hook, IConfig } from '@oclif/config'
import * as createDebug from 'debug'
 type Options = { Command: any, argv: string[] } & { config: IConfig }

const debug = createDebug('nimbella-prerun')

const hook: Hook.Prerun = async function(opts: Options) {
  debug('Prerun: %O', opts)
}

export default hook
