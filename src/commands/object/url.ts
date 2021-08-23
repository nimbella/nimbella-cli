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
import { authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getObjectStorageClient } from '../../storage/clients'
import { errorHandler } from '../../storage/util'

export default class ObjectUrl extends NimBaseCommand {
    static description = 'Generates Signed URL for an Object in the Object Store'

    static flags = {
      namespace: flags.string({ description: 'The namespace to get the object URL from (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace to get object URL from' }),
      permission: flags.string({ char: 'p', description: 'Permission applicable on the URL', options: ['read', 'write'], default: 'read' }),
      ttl: flags.integer({ char: 't', description: 'Expiration time of the URL (in Minutes)', default: 15 }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'objectName', description: 'The object to get URL for', required: true },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client } = await getObjectStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`)

      try {
        const file = client.file(args.objectName)
        const expiration = flags.ttl * 60 * 1000
        const options = {
          version: 'v4' as 'v2' | 'v4',
          action: flags.permission,
          expires: Date.now() + expiration,
          contentType: undefined
        }
        if (flags.permission === 'write') { options.contentType = 'application/octet-stream' }
        const url = await file.getSignedUrl(options)
        logger.log(url)
        return
      } catch (e) {
        errorHandler(e, logger, args.objectName)
      }
    }
}
