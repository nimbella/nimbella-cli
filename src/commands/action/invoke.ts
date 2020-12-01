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

import { NimBaseCommand, NimLogger, inBrowser, CaptureLogger } from 'nimbella-deployer'
import { flags } from '@oclif/command'
import { Action } from 'openwhisk'
import { open } from '../../ui'
import { RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime'
import { createKeyValueArrayFromFlag, createKeyValueArrayFromFile } from '@adobe/aio-lib-runtime'
import * as makeDebug from 'debug'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/invoke')
const ActionGet: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/get')

const debug = makeDebug('nim:invoke:web')

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
    if (flags.web) {
      // Special handling when --web flag is specified
      return await this.invokeViaWeb(args.actionName, flags, logger)
    } else {
      return await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
    }
  }

  // Distinct from the main 'invoke' path but sharing many of its flags: do GET on the action's web URL (if it has one).
  // It is an error if the action is not a web action.
  async invokeViaWeb(actionName: string, flags: any, logger: NimLogger) {
    // Run the aio 'action get' to grab the action metadata
    const capture = new CaptureLogger()
    debug('invoking aio to get action metadata')
    await this.runAio([actionName], [actionName], { actionName }, {}, capture, ActionGet)
    const action = capture.entity as unknown as Action
    debug('action metadata retrieved: %O', action)
    // Check that it is a web action
    const webFlag = action.annotations.find(elem => elem.key === 'web-export')
    if (!webFlag || webFlag.value !== true) {
      logger.handleError(`action '${actionName}' is not a web action`)
    }
    debug('the action is a web action')
    // Form the URL for the GET.   We use the standard (API ingress) URL here, not the simplified one
    const [namespace, packageName] = action.namespace.split('/')
    const effectiveName = `${packageName || 'default'}/${action.name}`
    const host = flags.apihost || process.env.AIO_RUNTIME_APIHOST
    const url = `${host}/api/v1/web/${namespace}/${effectiveName}`
    debug('computed URL is %s', url)
    // Add parameters, if any, in the form of a query
    let params: any
    if (flags.param) {
      params = createKeyValueArrayFromFlag(flags.param)
    } else if (flags['param-file']) {
      params = createKeyValueArrayFromFile(flags['param-file'])
    }
    let query = params ? '?' : ''
    if (params) {
      for (const param of params) {
        const toAdd = param.key + '=' + encodeURI(param.value)
        query += query === '?' ? toAdd : ',' + toAdd
      }
    }
    // Open the URL in a browser or in the workbench sidecar.
    const result = await open(url+query, true)
    if (inBrowser && typeof result === 'object' && logger instanceof CaptureLogger) {
      // In the workbench.  Have to save the result for return to the REPL in order to achieve sidecar display
      logger.entity = result
      logger.command = [ 'sidecar' ] // pseudo-command known to the output processor
    }
  }

  static args = AioCommand.args

  // The template for parsing the flags is not changed for the browser because it is only used by oclif parsing
  // The browser inverts the flags by a special case in the usage model generator.
  static flags = {
    web: flags.boolean({ description: 'Invoke as a web action, show result as web page'}),
    ...AioCommand.flags
  }

  static description = AioCommand.description
}
