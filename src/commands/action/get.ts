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

import { NimBaseCommand, NimLogger, CaptureLogger, authPersister, getCredentials, getCredentialsForNamespace, inBrowser } from 'nimbella-deployer'

import { default as RuntimeBaseCommand } from '@adobe/aio-cli-plugin-runtime/src/RuntimeBaseCommand'
const AioCommand: typeof RuntimeBaseCommand = require('@adobe/aio-cli-plugin-runtime/src/commands/runtime/action/get')

export default class ActionGet extends NimBaseCommand {
  async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger) {
    AioCommand.fullGet = inBrowser
    if (flags.url) {
      const capture = new CaptureLogger()
      await this.runAio(rawArgv, argv, args, flags, capture, AioCommand)
      logger.log(await this.simplifyUrl(capture.captured[0]))
    } else {
      await this.runAio(rawArgv, argv, args, flags, logger, AioCommand)
    }
  }

  static args = AioCommand.args

  static flags = AioCommand.flags

  static description = AioCommand.description

  // This function simplifies a web action URL if the namespace is in the present user's credential store
  // and has storage.  The simplified URL requires this since it will go through the bucketingress.
  async simplifyUrl(url: string): Promise<string> {
    if (url.includes('/api/v1/web/')) {
      const parts = url.split('/api/v1/web/')
      if (parts.length === 2) {
        // It should, but let's be careful
        const apihost = parts[0]
        const pathParts = parts[1].split('/')
        const namespace = pathParts[0]
        const actionPath = pathParts.slice(1).join('/')
        let hasStorage = false
        try {
          const creds = await getCredentialsForNamespace(namespace, apihost, authPersister)
          hasStorage = !!creds.storageKey
        } catch {
          // ignore; hasStorage remains false
        }
        if (hasStorage) {
          const hostname = new URL(apihost).hostname
          url = `https://${namespace}-${hostname}/api/${actionPath}`
        }
      }
    }
    return url
  }
}
