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
import { getObjectStorageClient } from '../../storage/clients'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { spinner } from '../../ui'
import { errorHandler } from '../../storage/util'

export default class ObjectGet extends NimBaseCommand {
    static description = 'Gets Object from the Object Store'

    static flags = {
      namespace: flags.string({ description: 'The namespace to get the object from (current namespace if omitted)' }),
      apihost: flags.string({ description: 'API host of the namespace to get object from' }),
      save: flags.boolean({ char: 's', description: 'Saves object on file system (default)', default: true }),
      'save-as': flags.string({ description: 'Saves object on file system with the given name', exclusive: ['save', 'saveAs'] }),
      saveAs: flags.string({ description: 'Saves object on file system with the given name', exclusive: ['save', 'save-as'] }),
      print: flags.boolean({ char: 'p', description: 'Prints content on terminal' }),
      ...NimBaseCommand.flags
    }

    static args = [
      { name: 'objectName', description: 'The object to get', required: true },
      { name: 'destination', description: 'The location to write object at', required: true, default: './' },
      { name: 'namespace', required: false, hidden: true }
    ]

    async runCommand(rawArgv: string[], argv: string[], args: any, flags: any, logger: NimLogger): Promise<void> {
      const { client } = await getObjectStorageClient(args, flags, authPersister)
      if (!client) logger.handleError(`Couldn't get to the object store, ensure it's enabled for the ${args.namespace || 'current'} namespace`)
      await this.downloadFile(args.objectName, args.destination, client, logger, flags).catch((err: Error) => logger.handleError('', err))
    }

    async downloadFile(objectName: string, destination: string, client: StorageClient, logger: NimLogger, flags:any): Promise<void> {
      const { 'save-as': save_as, saveAs, save, print } = flags
      if (!existsSync(destination)) {
        logger.handleError(`${destination} doesn't exist`)
      }
      const loader = await spinner()
      loader.start(`getting ${objectName}`, 'downloading', { stdout: true })
      if (print) {
        try {
          const contents = await client.file(objectName).download()
          loader.stop()
          logger.log('\n')
          logger.log(String.fromCharCode.apply(null, contents))
        } catch (err) {
          loader.stop('couldn\'t print content')
          errorHandler(err, logger, objectName)
        }
      } else if (save || (saveAs || save_as)) {
        const fileName = basename(objectName)
        await client.file(objectName).download({ destination: join(destination, ((saveAs || save_as) || fileName)) }).then(_ => loader.stop('done'))
      }
    }
}
