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
import { StorageClient, authPersister } from '@nimbella/nimbella-deployer'
import { NimBaseCommand, NimLogger } from '../../NimBaseCommand'
import { getWebStorageClient } from '../../storage/clients'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { spinner } from '../../ui'
import { errorHandler } from '../../storage/util'

export default class WebContentGet extends NimBaseCommand {
    static description = 'Gets Content from the Web Storage'

    static flags = {
      namespace: flags.string({ description: 'The namespace from which to get web content (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace from which to get web content' }),
      save: flags.boolean({ char: 's', description: 'Saves content on file system (default)', default: true }),
      'save-as': flags.string({ description: 'Saves content on file system with the given name', exclusive: ['save', 'saveAs'] }),
      saveAs: flags.string({ description: 'Saves content on file system with the given name', exclusive: ['save', 'save-as'] }),
      print: flags.boolean({ char: 'p', description: 'Prints content on terminal' }),
      url: flags.boolean({ char: 'r', description: 'Get web content url' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'webContentName', description: 'The web content to get', required: true },
      { name: 'destination', description: 'The location to write at', required: true, default: './' },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client, creds } = await getWebStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the web storage, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
      if (flags.url) {
        // check if file exists, otherwise catch error and report non-availability
        const exists = await client.file(args.webContentName).exists()
        if (exists) {
          const url = new URL(creds.ow.apihost)
          logger.log(`https://${creds.namespace}-${url.hostname}/${args.webContentName}`)
          return
        }
        logger.handleError(`${args.webContentName} is not available.`)
      } else { await this.downloadFile(args.webContentName, args.destination, client, logger, flags).catch((err: Error) => logger.handleError('', err)) }
    }

    async downloadFile(webContentName: string, destination: string, client: StorageClient, logger: NimLogger, flags:any) : Promise<void> {
      const { 'save-as': save_as, saveAs, save, print } = flags
      if (!existsSync(destination)) {
        logger.handleError(`${destination} doesn't exist`)
      }
      const loader = await spinner()
      loader.start(`getting ${webContentName}`, 'downloading', { stdout: true })
      if (print) {
        try {
          const contents = await client.file(webContentName).download()
          loader.stop()
          logger.log('\n')
          logger.log(String.fromCharCode.apply(null, contents))
        } catch (err) {
          loader.stop('couldn\'t print content')
          errorHandler(err, logger, webContentName)
        }
      } else if (save || (saveAs || save_as)) {
        const fileName = basename(webContentName)
        await client.file(webContentName).download({ destination: join(destination, ((saveAs || save_as) || fileName)) }).then(_ => loader.stop('done'))
      }
    }
}
