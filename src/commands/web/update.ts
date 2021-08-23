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
import { basename, isAbsolute } from 'path'
import { existsSync, lstatSync } from 'fs'
import { spinner } from '../../ui'
import { StorageClient, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getWebStorageClient } from '../../storage/clients'

export default class WebContentUpdate extends NimBaseCommand {
    static description = 'Updates Content in the Web Storage'

    static flags = {
      namespace: flags.string({ description: 'The namespace in which to update content (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace in which to update content' }),
      destination: flags.string({ char: 'd', description: 'Target location in web storage' }),
      cache: flags.integer({ char: 'c', description: 'Maximum amount of time in seconds, the web content is considered fresh, relative to the time of the request' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'webContentPath', description: 'Path to the content to be updated', required: true },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client } = await getWebStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
      await this.uploadFile(args.webContentPath, flags.destination, flags.cache, client, logger).catch((err: Error) => logger.handleError('', err))
    }

    private async uploadFile(webContentPath: string, destination: string, cache: number, client: StorageClient, logger: NimLogger) {
      if (!existsSync(webContentPath)) {
        logger.handleError(`${webContentPath} doesn't exist`)
      }
      if (!lstatSync(webContentPath).isFile()) {
        logger.handleError(`${webContentPath} is not a valid file`)
      }
      const contentName = basename(webContentPath)

      let targetPath = webContentPath
      if (isAbsolute(webContentPath)) targetPath = contentName
      if (destination) targetPath = destination

      const loader = await spinner()

      const exists = await client.file(targetPath).exists()
      if (!exists) {
        logger.handleError(`${targetPath} doesn't exist, use 'web:create' to add it. e.g. nim web add ${contentName}`)
      }

      loader.start(`updating ${targetPath}`, 'uploading', { stdout: true })
      await client.upload(webContentPath, {
        destination: targetPath,
        gzip: true,
        metadata: {
          cacheControl: cache ? `public, max-age=${cache}` : 'no-cache'
        }
      }).then(_ => loader.stop('done'))
    }
}
